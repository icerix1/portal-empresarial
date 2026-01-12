use axum::extract::State;
use axum::http::{header, HeaderMap, Method, StatusCode};
use axum::response::IntoResponse;
use axum::routing::{get, post};
use axum::Json;
use futures_util::TryStreamExt;
use percent_encoding::utf8_percent_encode;
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::env;
use std::sync::Arc;
use tower_http::cors::{Any, CorsLayer};

#[derive(Clone)]
struct AppState {
  http: reqwest::Client,
  project_id: String,
  translate_key: String,
}

#[derive(Debug, Deserialize)]
#[allow(non_snake_case)]
struct AddCommentRequest {
  #[serde(default)]
  postId: String,
  #[serde(default)]
  id: Option<i64>,
  #[serde(default)]
  author: String,
  #[serde(default)]
  text: String,
  #[serde(default)]
  lang: String,
  #[serde(default)]
  isAdmin: bool,
}

#[derive(Debug, Deserialize)]
#[allow(non_snake_case)]
struct DownloadQuery {
  #[serde(default)]
  bucket: String,
  #[serde(default)]
  filePath: String,
}

#[derive(Debug, Serialize)]
struct OkResponse<T> {
  ok: bool,
  #[serde(skip_serializing_if = "Option::is_none")]
  comment: Option<T>,
  #[serde(skip_serializing_if = "Option::is_none")]
  error: Option<String>,
}

fn normalize_lang(raw: &str) -> &str {
  match raw.trim().to_lowercase().as_str() {
    "es" => "es",
    "en" => "en",
    _ => "en",
  }
}

async fn healthz() -> impl IntoResponse {
  (StatusCode::OK, "ok")
}

async fn root() -> impl IntoResponse {
  (StatusCode::OK, "ok")
}

async fn download_proxy(
  State(state): State<Arc<AppState>>,
  axum::extract::Query(q): axum::extract::Query<DownloadQuery>,
) -> impl IntoResponse {
  let bucket = q.bucket.trim().to_string();
  let file_path = q.filePath.trim().to_string();
  if file_path.is_empty() {
    return (
      StatusCode::BAD_REQUEST,
      Json(json!({ "ok": false, "error": "Missing filePath" })),
    )
      .into_response();
  }

  let token = match fetch_access_token(&state.http).await {
    Ok(t) => t,
    Err(e) => {
      return (
        StatusCode::INTERNAL_SERVER_ERROR,
        Json(json!({ "ok": false, "error": format!("auth token error: {e}") })),
      )
        .into_response();
    }
  };

  let mut candidates: Vec<String> = Vec::new();
  if !bucket.is_empty() {
    candidates.push(bucket.clone());
    if bucket.ends_with(".firebasestorage.app") {
      candidates.push(
        bucket
          .trim_end_matches(".firebasestorage.app")
          .to_string()
          + ".appspot.com",
      );
    }
  }
  if !state.project_id.is_empty() {
    candidates.push(format!("{}.appspot.com", state.project_id));
    candidates.push(format!("{}.firebasestorage.app", state.project_id));
  }

  candidates.retain(|b| !b.trim().is_empty());
  candidates.dedup();

  for b in candidates {
    match gcs_stream_object(&state.http, &token, &b, &file_path).await {
      Ok(Some(resp)) => return resp,
      Ok(None) => continue,
      Err(e) => {
        return (
          StatusCode::INTERNAL_SERVER_ERROR,
          Json(json!({ "ok": false, "error": format!("gcs error: {e}") })),
        )
          .into_response();
      }
    }
  }

  (
    StatusCode::NOT_FOUND,
    Json(json!({ "ok": false, "error": "Not found" })),
  )
    .into_response()
}

async fn add_comment(
  State(state): State<Arc<AppState>>,
  headers: HeaderMap,
  Json(mut body): Json<AddCommentRequest>,
) -> impl IntoResponse {
  body.postId = body.postId.trim().to_string();
  body.text = body.text.trim().to_string();
  body.author = body.author.trim().to_string();
  body.lang = normalize_lang(&body.lang).to_string();

  if body.author.is_empty() {
    body.author = "Anonymous".to_string();
  }

  if body.text.is_empty() {
    return (
      StatusCode::BAD_REQUEST,
      Json(OkResponse::<serde_json::Value> {
        ok: false,
        comment: None,
        error: Some("Missing text".to_string()),
      }),
    );
  }

  let token = match fetch_access_token(&state.http).await {
    Ok(t) => t,
    Err(e) => {
      return (
        StatusCode::INTERNAL_SERVER_ERROR,
        Json(OkResponse::<serde_json::Value> {
          ok: false,
          comment: None,
          error: Some(format!("auth token error: {e}")),
        }),
      );
    }
  };

  let doc_id = match resolve_post_doc_id(&state.http, &state.project_id, &token, &body).await {
    Ok(id) => id,
    Err(e) => {
      return (
        StatusCode::BAD_REQUEST,
        Json(OkResponse::<serde_json::Value> {
          ok: false,
          comment: None,
          error: Some(format!("Missing postId: {e}")),
        }),
      );
    }
  };

  let other_lang = if body.lang == "es" { "en" } else { "es" };
  let translated = if !state.translate_key.is_empty() {
    translate_text(
      &state.http,
      &state.translate_key,
      &body.text,
      &body.lang,
      other_lang,
    )
    .await
    .unwrap_or_default()
  } else {
    String::new()
  };

  let created_at = chrono_millis();
  let comment_id = format!(
    "{}_{}",
    created_at,
    rand_suffix()
  );

  let comment = json!({
    "id": comment_id,
    "uid": null,
    "author": body.author,
    "text": body.text,
    "lang": body.lang,
    "createdAt": created_at,
    "isAdmin": body.isAdmin,
    "textByLang": {
      body.lang.clone(): body.text,
      other_lang: translated,
    }
  });

  if let Err(e) = firestore_array_union_comment(
    &state.http,
    &state.project_id,
    &token,
    &doc_id,
    &comment,
  )
  .await
  {
    let origin = headers
      .get(header::ORIGIN)
      .and_then(|v| v.to_str().ok())
      .unwrap_or("");
    let _ = origin;
    return (
      StatusCode::INTERNAL_SERVER_ERROR,
      Json(OkResponse::<serde_json::Value> {
        ok: false,
        comment: None,
        error: Some(format!("firestore error: {e}")),
      }),
    );
  }

  (
    StatusCode::OK,
    Json(OkResponse::<serde_json::Value> {
      ok: true,
      comment: Some(comment),
      error: None,
    }),
  )
}

fn chrono_millis() -> i64 {
  use std::time::{SystemTime, UNIX_EPOCH};
  SystemTime::now()
    .duration_since(UNIX_EPOCH)
    .map(|d| d.as_millis() as i64)
    .unwrap_or(0)
}

fn rand_suffix() -> String {
  let r = fastrand::u64(..);
  format!("{:x}", r)
}

async fn fetch_access_token(http: &reqwest::Client) -> anyhow::Result<String> {
  if let Ok(t) = env::var("FIRESTORE_ACCESS_TOKEN") {
    let s = t.trim().to_string();
    if !s.is_empty() {
      return Ok(s);
    }
  }
  let resp = http
    .get("http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token")
    .header("Metadata-Flavor", "Google")
    .send()
    .await?;
  let status = resp.status();
  let json: serde_json::Value = resp.json().await.unwrap_or(json!({}));
  if !status.is_success() {
    anyhow::bail!("metadata token http {}", status);
  }
  let token = json
    .get("access_token")
    .and_then(|v| v.as_str())
    .unwrap_or("")
    .to_string();
  if token.is_empty() {
    anyhow::bail!("missing access_token");
  }
  Ok(token)
}

async fn gcs_stream_object(
  http: &reqwest::Client,
  token: &str,
  bucket: &str,
  object_name: &str,
) -> anyhow::Result<Option<axum::response::Response>> {
  let bucket = bucket.trim();
  if bucket.is_empty() {
    return Ok(None);
  }

  let encoded_object = utf8_percent_encode(object_name, percent_encoding::NON_ALPHANUMERIC)
    .to_string();
  let url = format!(
    "https://storage.googleapis.com/storage/v1/b/{}/o/{}?alt=media",
    bucket, encoded_object
  );

  let upstream = http.get(url).bearer_auth(token).send().await?;
  let status = upstream.status();
  if status.as_u16() == 404 {
    return Ok(None);
  }
  if !status.is_success() {
    let t = upstream.text().await.unwrap_or_default();
    anyhow::bail!("upstream http {} {}", status, t);
  }

  let mut builder = axum::response::Response::builder().status(status);
  if let Some(v) = upstream.headers().get(header::CONTENT_TYPE) {
    builder = builder.header(header::CONTENT_TYPE, v);
  }
  if let Some(v) = upstream.headers().get(header::CONTENT_LENGTH) {
    builder = builder.header(header::CONTENT_LENGTH, v);
  }
  if let Some(v) = upstream.headers().get(header::CACHE_CONTROL) {
    builder = builder.header(header::CACHE_CONTROL, v);
  }

  let stream = upstream
    .bytes_stream()
    .map_err(|e| std::io::Error::new(std::io::ErrorKind::Other, e));
  let body = axum::body::Body::from_stream(stream);
  let resp = builder.body(body)?;
  Ok(Some(resp))
}

fn is_digits(s: &str) -> bool {
  !s.is_empty() && s.chars().all(|c| c.is_ascii_digit())
}

async fn resolve_post_doc_id(
  http: &reqwest::Client,
  project_id: &str,
  token: &str,
  req: &AddCommentRequest,
) -> anyhow::Result<String> {
  let direct = req.postId.trim();
  if !direct.is_empty() && !is_digits(direct) {
    return Ok(direct.to_string());
  }

  let legacy = if let Some(id) = req.id {
    Some(id)
  } else if is_digits(direct) {
    direct.parse::<i64>().ok()
  } else {
    None
  };

  let legacy = legacy.ok_or_else(|| anyhow::anyhow!("no postId or legacy id"))?;
  let url = format!("https://firestore.googleapis.com/v1/projects/{project_id}/databases/(default)/documents:runQuery");
  let body = json!({
    "structuredQuery": {
      "from": [{ "collectionId": "posts" }],
      "where": {
        "fieldFilter": {
          "field": { "fieldPath": "id" },
          "op": "EQUAL",
          "value": { "integerValue": legacy.to_string() }
        }
      },
      "limit": 1
    }
  });

  let resp = http
    .post(url)
    .bearer_auth(token)
    .json(&body)
    .send()
    .await?;
  let status = resp.status();
  let rows: serde_json::Value = resp.json().await.unwrap_or(json!([]));
  if !status.is_success() {
    anyhow::bail!("runQuery http {}", status);
  }

  let arr = rows.as_array().cloned().unwrap_or_default();
  for row in arr {
    if let Some(name) = row
      .get("document")
      .and_then(|d| d.get("name"))
      .and_then(|n| n.as_str())
    {
      if let Some(doc_id) = name.rsplit('/').next() {
        if !doc_id.is_empty() {
          return Ok(doc_id.to_string());
        }
      }
    }
  }

  anyhow::bail!("post not found")
}

fn fs_string(value: &str) -> serde_json::Value {
  json!({ "stringValue": value })
}

fn fs_bool(value: bool) -> serde_json::Value {
  json!({ "booleanValue": value })
}

fn fs_int(value: i64) -> serde_json::Value {
  json!({ "integerValue": value.to_string() })
}

fn fs_null() -> serde_json::Value {
  json!({ "nullValue": serde_json::Value::Null })
}

fn fs_map(fields: serde_json::Map<String, serde_json::Value>) -> serde_json::Value {
  json!({ "mapValue": { "fields": fields } })
}

fn comment_to_firestore_value(comment: &serde_json::Value) -> serde_json::Value {
  let obj = comment.as_object().cloned().unwrap_or_default();
  let mut fields = serde_json::Map::new();

  let id = obj.get("id").and_then(|v| v.as_str()).unwrap_or("");
  fields.insert("id".to_string(), fs_string(id));

  let uid_is_null = obj.get("uid").map(|v| v.is_null()).unwrap_or(true);
  if uid_is_null {
    fields.insert("uid".to_string(), fs_null());
  }

  let author = obj.get("author").and_then(|v| v.as_str()).unwrap_or("");
  fields.insert("author".to_string(), fs_string(author));

  let text = obj.get("text").and_then(|v| v.as_str()).unwrap_or("");
  fields.insert("text".to_string(), fs_string(text));

  let lang = obj.get("lang").and_then(|v| v.as_str()).unwrap_or("en");
  fields.insert("lang".to_string(), fs_string(lang));

  let created_at = obj.get("createdAt").and_then(|v| v.as_i64()).unwrap_or(0);
  fields.insert("createdAt".to_string(), fs_int(created_at));

  let is_admin = obj.get("isAdmin").and_then(|v| v.as_bool()).unwrap_or(false);
  fields.insert("isAdmin".to_string(), fs_bool(is_admin));

  if let Some(tl) = obj.get("textByLang").and_then(|v| v.as_object()) {
    let mut tl_fields = serde_json::Map::new();
    for (k, v) in tl {
      if let Some(s) = v.as_str() {
        tl_fields.insert(k.to_string(), fs_string(s));
      }
    }
    fields.insert("textByLang".to_string(), fs_map(tl_fields));
  }

  fs_map(fields)
}

async fn firestore_array_union_comment(
  http: &reqwest::Client,
  project_id: &str,
  token: &str,
  doc_id: &str,
  comment: &serde_json::Value,
) -> anyhow::Result<()> {
  let url = format!("https://firestore.googleapis.com/v1/projects/{project_id}/databases/(default)/documents:commit");
  let document = format!(
    "projects/{project_id}/databases/(default)/documents/posts/{doc_id}"
  );

  let value = comment_to_firestore_value(comment);
  let body = json!({
    "writes": [{
      "transform": {
        "document": document,
        "fieldTransforms": [{
          "fieldPath": "comments",
          "appendMissingElements": {
            "values": [value]
          }
        }]
      }
    }]
  });

  let resp = http
    .post(url)
    .bearer_auth(token)
    .json(&body)
    .send()
    .await?;
  let status = resp.status();
  if !status.is_success() {
    let t = resp.text().await.unwrap_or_default();
    anyhow::bail!("commit http {} {}", status, t);
  }
  Ok(())
}

async fn translate_text(
  http: &reqwest::Client,
  key: &str,
  text: &str,
  source: &str,
  target: &str,
) -> anyhow::Result<String> {
  if text.trim().is_empty() {
    return Ok(String::new());
  }
  if source == target {
    return Ok(text.to_string());
  }

  let url = format!("https://translation.googleapis.com/language/translate/v2?key={key}");
  let resp = http
    .post(url)
    .json(&json!({
      "q": text,
      "source": source,
      "target": target,
      "format": "text"
    }))
    .send()
    .await?;
  let status = resp.status();
  let json: serde_json::Value = resp.json().await.unwrap_or(json!({}));
  if !status.is_success() {
    return Ok(String::new());
  }
  let translated = json
    .get("data")
    .and_then(|d| d.get("translations"))
    .and_then(|t| t.as_array())
    .and_then(|a| a.first())
    .and_then(|x| x.get("translatedText"))
    .and_then(|v| v.as_str())
    .unwrap_or("")
    .to_string();
  Ok(translated)
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
  println!("booting portal-backend");
  let project_id = env::var("GOOGLE_CLOUD_PROJECT")
    .or_else(|_| env::var("GCLOUD_PROJECT"))
    .unwrap_or_else(|_| "compresor-de-archivos-15e3a".to_string());
  let translate_key = env::var("TRANSLATE_API_KEY")
    .or_else(|_| env::var("GOOGLE_TRANSLATE_API_KEY"))
    .unwrap_or_default();

  let http = reqwest::Client::builder().build()?;
  let state = Arc::new(AppState {
    http,
    project_id,
    translate_key,
  });

  let cors = CorsLayer::new()
    .allow_origin(Any)
    .allow_methods([Method::GET, Method::POST, Method::OPTIONS])
    .allow_headers([header::CONTENT_TYPE, header::AUTHORIZATION]);

  let app = axum::Router::new()
    .route("/", get(root))
    .route("/health", get(healthz))
    .route("/healthz", get(healthz))
    .route("/v1/comments", post(add_comment))
    .route("/v1/download", get(download_proxy))
    .layer(cors)
    .with_state(state);

  let port: u16 = env::var("PORT")
    .ok()
    .and_then(|v| v.parse().ok())
    .unwrap_or(8080);
  let addr = std::net::SocketAddr::from(([0, 0, 0, 0], port));
  let listener = match tokio::net::TcpListener::bind(addr).await {
    Ok(l) => l,
    Err(e) => {
      eprintln!("bind error: {e}");
      return Err(e.into());
    }
  };
  println!("listening on {addr}");
  if let Err(e) = axum::serve(listener, app).await {
    eprintln!("serve error: {e}");
    return Err(e.into());
  }
  Ok(())
}
