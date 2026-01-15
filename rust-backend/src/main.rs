use async_zip::tokio::write::ZipFileWriter;
use async_zip::{Compression, ZipEntryBuilder};
use axum::extract::{Query, State};
use axum::http::{header, HeaderMap, HeaderName, Method, StatusCode};
use axum::response::{IntoResponse, Response};
use axum::routing::{get, post};
use axum::Json;
use futures_lite::io::AsyncWriteExt as FuturesWriteExt;
use futures_util::{StreamExt, TryStreamExt};
use percent_encoding::utf8_percent_encode;
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::env;
use std::sync::Arc;
use tokio::io::AsyncWriteExt as TokioWriteExt;
use tokio_util::io::ReaderStream;
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
  clientId: String,
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

#[derive(Debug, Deserialize)]
#[allow(non_snake_case)]
struct ZipQuery {
  #[serde(default)]
  bucket: String,
  #[serde(default)]
  prefix: String,
  #[serde(default)]
  name: String,
}

#[derive(Debug, Deserialize)]
#[allow(non_snake_case)]
struct SignedUrlQuery {
  #[serde(default)]
  bucket: String,
  #[serde(default)]
  filePath: String,
  #[serde(default)]
  expires: i64,
}

#[derive(Debug, Serialize)]
struct OkResponse<T> {
  ok: bool,
  #[serde(skip_serializing_if = "Option::is_none")]
  comment: Option<T>,
  #[serde(skip_serializing_if = "Option::is_none")]
  error: Option<String>,
}

#[derive(Debug, Deserialize)]
#[allow(non_snake_case)]
struct BanRequest {
  #[serde(default)]
  clientKey: String,
  #[serde(default)]
  reason: String,
}

const URL_ENCODE_SET: &percent_encoding::AsciiSet = &percent_encoding::NON_ALPHANUMERIC
  .remove(b'-')
  .remove(b'_')
  .remove(b'.')
  .remove(b'~');

const COMMENT_COOLDOWN_GLOBAL_MS: i64 = 60_000;
const COMMENT_COOLDOWN_PER_POST_MS: i64 = 600_000;

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
  headers: HeaderMap,
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
    match gcs_stream_object(&state.http, &token, &b, &file_path, &headers).await {
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

async fn zip_folder(
  State(state): State<Arc<AppState>>,
  Query(q): Query<ZipQuery>,
) -> impl IntoResponse {
  let prefix = q.prefix.trim().to_string();
  if prefix.is_empty() {
    return (
      StatusCode::BAD_REQUEST,
      Json(json!({ "ok": false, "error": "Missing prefix" })),
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

  let candidates = build_bucket_candidates(&q.bucket, &state.project_id);

  let mut chosen_bucket: Option<String> = None;
  let mut object_names: Vec<String> = Vec::new();
  for b in candidates {
    match gcs_list_objects(&state.http, &token, &b, &prefix).await {
      Ok(list) => {
        if !list.is_empty() {
          chosen_bucket = Some(b);
          object_names = list;
          break;
        }
      }
      Err(e) => {
        return (
          StatusCode::INTERNAL_SERVER_ERROR,
          Json(json!({ "ok": false, "error": format!("gcs list error: {e}") })),
        )
          .into_response();
      }
    }
  }

  let chosen_bucket = match chosen_bucket {
    Some(b) => b,
    None => {
      return (
        StatusCode::NOT_FOUND,
        Json(json!({ "ok": false, "error": "Not found" })),
      )
        .into_response();
    }
  };

  let mut zip_name = q.name.trim().to_string();
  if zip_name.is_empty() {
    zip_name = "folder".to_string();
  }
  if !zip_name.to_lowercase().ends_with(".zip") {
    zip_name.push_str(".zip");
  }
  let zip_name = zip_name.replace('"', "_");

  let (mut reader, mut writer) = tokio::io::duplex(1024 * 128);
  let http = state.http.clone();
  let token = token.clone();
  let prefix_clone = prefix.clone();
  tokio::spawn(async move {
    let res: anyhow::Result<()> = async {
      let mut zip = ZipFileWriter::with_tokio(&mut writer);

      for object_name in object_names {
        if object_name.ends_with('/') {
          continue;
        }

        let entry_name = zip_entry_name(&prefix_clone, &object_name);
        if entry_name.trim().is_empty() {
          continue;
        }

        let builder = ZipEntryBuilder::new(entry_name.into(), Compression::Stored);
        let mut entry = zip.write_entry_stream(builder).await?;

        let url = gcs_media_url(&chosen_bucket, &object_name);
        let upstream = http.get(url).bearer_auth(&token).send().await?;
        let status = upstream.status();
        if !status.is_success() {
          anyhow::bail!("upstream http {}", status);
        }

        let mut stream = upstream.bytes_stream();
        while let Some(chunk) = stream.next().await {
          let bytes = chunk?;
          entry.write_all(&bytes).await?;
        }
        entry.close().await?;
      }

      zip.close().await?;
      Ok(())
    }
    .await;

    if res.is_err() {
      let _ = writer.shutdown().await;
    }
  });

  let mut builder = Response::builder().status(StatusCode::OK);
  builder = builder.header(header::CONTENT_TYPE, "application/zip");
  builder = builder.header(
    header::CONTENT_DISPOSITION,
    format!("attachment; filename=\"{zip_name}\""),
  );
  builder = builder.header(header::CACHE_CONTROL, "no-store");

  let body = axum::body::Body::from_stream(ReaderStream::new(reader));
  match builder.body(body) {
    Ok(resp) => resp,
    Err(_) => (
      StatusCode::INTERNAL_SERVER_ERROR,
      Json(json!({ "ok": false, "error": "response build error" })),
    )
      .into_response(),
  }
}

async fn signed_url(
  State(state): State<Arc<AppState>>,
  Query(q): Query<SignedUrlQuery>,
) -> impl IntoResponse {
  let bucket = q.bucket.trim().to_string();
  let file_path = q.filePath.trim().to_string();
  if bucket.is_empty() || file_path.is_empty() {
    return (
      StatusCode::BAD_REQUEST,
      Json(json!({ "ok": false, "error": "Missing bucket or filePath" })),
    )
      .into_response();
  }

  let expires = if q.expires > 0 { q.expires } else { 3600 };
  let expires = expires.clamp(60, 604800);

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

  let service_account = env::var("GCS_SIGNING_SERVICE_ACCOUNT")
    .or_else(|_| env::var("GOOGLE_SERVICE_ACCOUNT_EMAIL"))
    .unwrap_or_default();
  let service_account = if service_account.trim().is_empty() {
    match fetch_service_account_email(&state.http).await {
      Ok(v) => v,
      Err(e) => {
        return (
          StatusCode::INTERNAL_SERVER_ERROR,
          Json(json!({ "ok": false, "error": format!("metadata email error: {e}") })),
        )
          .into_response();
      }
    }
  } else {
    service_account.trim().to_string()
  };

  let url = match gcs_signed_url_v4(
    &state.http,
    &token,
    &service_account,
    &bucket,
    &file_path,
    expires as u32,
  )
  .await
  {
    Ok(u) => u,
    Err(e) => {
      return (
        StatusCode::INTERNAL_SERVER_ERROR,
        Json(json!({ "ok": false, "error": format!("sign error: {e}") })),
      )
        .into_response();
    }
  };

  (StatusCode::OK, Json(json!({ "ok": true, "url": url }))).into_response()
}

async fn add_comment(
  State(state): State<Arc<AppState>>,
  headers: HeaderMap,
  Json(mut body): Json<AddCommentRequest>,
) -> impl IntoResponse {
  body.postId = body.postId.trim().to_string();
  body.text = body.text.trim().to_string();
  body.author = body.author.trim().to_string();
  body.clientId = body.clientId.trim().to_string();
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

  let ip = extract_client_ip(&headers).unwrap_or_default();
  let ua = extract_user_agent(&headers);
  let raw_client_id = if !ip.is_empty() {
    if ua.is_empty() {
      ip
    } else {
      format!("{ip}|{ua}")
    }
  } else {
    body.clientId.clone()
  };
  if raw_client_id.is_empty() {
    return (
      StatusCode::BAD_REQUEST,
      Json(OkResponse::<serde_json::Value> {
        ok: false,
        comment: None,
        error: Some("Missing clientId".to_string()),
      }),
    );
  }
  let client_id = raw_client_id;
  let client_key = client_key_hash(&client_id);

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

  let banned = firestore_is_banned(&state.http, &state.project_id, &token, &client_key)
    .await
    .unwrap_or(false);
  if banned {
    let msg = if body.lang == "es" {
      "Estás baneado permanentemente.".to_string()
    } else {
      "You are permanently banned.".to_string()
    };
    return (
      StatusCode::FORBIDDEN,
      Json(OkResponse::<serde_json::Value> {
        ok: false,
        comment: None,
        error: Some(msg),
      }),
    );
  }

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

  let now = chrono_millis();
  let global_limit_key = rate_limit_key("global", &client_id);
  let per_post_limit_key = rate_limit_key(&doc_id, &client_id);
  let global_wait = enforce_rate_limit_ms(
    &state.http,
    &state.project_id,
    &token,
    &global_limit_key,
    now,
    COMMENT_COOLDOWN_GLOBAL_MS,
  )
  .await
  .unwrap_or(0);
  if global_wait > 0 {
    let msg = if body.lang == "es" {
      format!("Esperá {}s antes de volver a comentar.", (global_wait + 999) / 1000)
    } else {
      format!("Wait {}s before commenting again.", (global_wait + 999) / 1000)
    };
    return (
      StatusCode::TOO_MANY_REQUESTS,
      Json(OkResponse::<serde_json::Value> {
        ok: false,
        comment: None,
        error: Some(msg),
      }),
    );
  }
  let per_post_wait = enforce_rate_limit_ms(
    &state.http,
    &state.project_id,
    &token,
    &per_post_limit_key,
    now,
    COMMENT_COOLDOWN_PER_POST_MS,
  )
  .await
  .unwrap_or(0);
  if per_post_wait > 0 {
    let msg = if body.lang == "es" {
      format!("Esperá {}s antes de comentar de nuevo en este post.", (per_post_wait + 999) / 1000)
    } else {
      format!(
        "Wait {}s before commenting again on this post.",
        (per_post_wait + 999) / 1000
      )
    };
    return (
      StatusCode::TOO_MANY_REQUESTS,
      Json(OkResponse::<serde_json::Value> {
        ok: false,
        comment: None,
        error: Some(msg),
      }),
    );
  }

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

  let created_at = now;
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
    "clientKey": client_key,
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

fn extract_client_ip(headers: &HeaderMap) -> Option<String> {
  let h = headers.get("x-forwarded-for").and_then(|v| v.to_str().ok())?;
  let first = h.split(',').next().unwrap_or("").trim();
  if first.is_empty() {
    None
  } else {
    Some(first.to_string())
  }
}

fn extract_user_agent(headers: &HeaderMap) -> String {
  headers
    .get(header::USER_AGENT)
    .and_then(|v| v.to_str().ok())
    .unwrap_or("")
    .trim()
    .to_string()
}

fn client_key_hash(value: &str) -> String {
  use sha2::{Digest, Sha256};
  let mut hasher = Sha256::new();
  hasher.update(value.as_bytes());
  hex::encode(hasher.finalize())
}

fn rate_limit_key(scope: &str, client_id: &str) -> String {
  use sha2::{Digest, Sha256};
  let mut hasher = Sha256::new();
  hasher.update(scope.as_bytes());
  hasher.update(b"|");
  hasher.update(client_id.as_bytes());
  hex::encode(hasher.finalize())
}

async fn firestore_get_limit_last_at(
  http: &reqwest::Client,
  project_id: &str,
  token: &str,
  key: &str,
) -> anyhow::Result<Option<i64>> {
  let key = key.trim();
  if key.is_empty() {
    return Ok(None);
  }
  let url = format!(
    "https://firestore.googleapis.com/v1/projects/{project_id}/databases/(default)/documents/comment_limits/{key}"
  );
  let resp = http.get(url).bearer_auth(token).send().await?;
  let status = resp.status();
  if status == StatusCode::NOT_FOUND {
    return Ok(None);
  }
  if !status.is_success() {
    anyhow::bail!("limit get http {}", status);
  }
  let json: serde_json::Value = resp.json().await.unwrap_or(json!({}));
  let last_at = json
    .get("fields")
    .and_then(|f| f.get("lastAt"))
    .and_then(|f| f.get("integerValue"))
    .and_then(|v| v.as_str())
    .and_then(|s| s.parse::<i64>().ok());
  Ok(last_at)
}

async fn firestore_set_limit_last_at(
  http: &reqwest::Client,
  project_id: &str,
  token: &str,
  key: &str,
  last_at: i64,
) -> anyhow::Result<()> {
  let key = key.trim();
  if key.is_empty() {
    return Ok(());
  }
  let url = format!("https://firestore.googleapis.com/v1/projects/{project_id}/databases/(default)/documents:commit");
  let name = format!(
    "projects/{project_id}/databases/(default)/documents/comment_limits/{key}"
  );
  let body = json!({
    "writes": [{
      "update": {
        "name": name,
        "fields": {
          "lastAt": fs_int(last_at),
          "updatedAt": fs_int(last_at)
        }
      },
      "updateMask": { "fieldPaths": ["lastAt", "updatedAt"] }
    }]
  });
  let resp = http.post(url).bearer_auth(token).json(&body).send().await?;
  let status = resp.status();
  if !status.is_success() {
    let t = resp.text().await.unwrap_or_default();
    anyhow::bail!("limit set http {} {}", status, t);
  }
  Ok(())
}

async fn enforce_rate_limit_ms(
  http: &reqwest::Client,
  project_id: &str,
  token: &str,
  key: &str,
  now: i64,
  cooldown_ms: i64,
) -> anyhow::Result<i64> {
  if key.trim().is_empty() {
    return Ok(0);
  }
  let last = firestore_get_limit_last_at(http, project_id, token, key).await?;
  let wait = match last {
    Some(v) if v > 0 && now >= v && now - v < cooldown_ms => cooldown_ms - (now - v),
    Some(v) if v > 0 && now < v && v - now < cooldown_ms => cooldown_ms,
    _ => 0,
  };
  if wait > 0 {
    return Ok(wait);
  }
  firestore_set_limit_last_at(http, project_id, token, key, now).await?;
  Ok(0)
}

async fn firestore_is_banned(
  http: &reqwest::Client,
  project_id: &str,
  token: &str,
  client_key: &str,
) -> anyhow::Result<bool> {
  let key = client_key.trim();
  if key.is_empty() {
    return Ok(false);
  }
  let url = format!(
    "https://firestore.googleapis.com/v1/projects/{project_id}/databases/(default)/documents/bans/{key}"
  );
  let resp = http.get(url).bearer_auth(token).send().await?;
  let status = resp.status();
  if status == StatusCode::NOT_FOUND {
    return Ok(false);
  }
  if !status.is_success() {
    anyhow::bail!("ban check http {}", status);
  }
  Ok(true)
}

fn env_admin_key() -> String {
  env::var("ADMIN_KEY")
    .or_else(|_| env::var("ADMIN_TOKEN"))
    .unwrap_or_default()
    .trim()
    .to_string()
}

fn is_valid_admin(headers: &HeaderMap) -> bool {
  let expected = env_admin_key();
  if expected.is_empty() {
    return false;
  }
  let provided = headers
    .get("x-admin-key")
    .and_then(|v| v.to_str().ok())
    .unwrap_or("")
    .trim()
    .to_string();
  !provided.is_empty() && provided == expected
}

async fn ban_user(
  State(state): State<Arc<AppState>>,
  headers: HeaderMap,
  Json(mut body): Json<BanRequest>,
) -> impl IntoResponse {
  if !is_valid_admin(&headers) {
    return (
      StatusCode::UNAUTHORIZED,
      Json(json!({ "ok": false, "error": "Unauthorized" })),
    )
      .into_response();
  }
  body.clientKey = body.clientKey.trim().to_string();
  body.reason = body.reason.trim().to_string();
  if body.clientKey.is_empty() {
    return (
      StatusCode::BAD_REQUEST,
      Json(json!({ "ok": false, "error": "Missing clientKey" })),
    )
      .into_response();
  }
  if body.clientKey.len() != 64 || !body.clientKey.chars().all(|c| c.is_ascii_hexdigit()) {
    return (
      StatusCode::BAD_REQUEST,
      Json(json!({ "ok": false, "error": "Invalid clientKey" })),
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

  let now = chrono_millis();
  let reason = if body.reason.is_empty() {
    "banned".to_string()
  } else {
    body.reason
  };

  let url = format!(
    "https://firestore.googleapis.com/v1/projects/{}/databases/(default)/documents:commit",
    state.project_id
  );
  let name = format!(
    "projects/{}/databases/(default)/documents/bans/{}",
    state.project_id, body.clientKey
  );
  let write = json!({
    "writes": [{
      "update": {
        "name": name,
        "fields": {
          "bannedAt": fs_int(now),
          "reason": fs_string(&reason),
          "permanent": fs_bool(true)
        }
      }
    }]
  });
  let resp = state
    .http
    .post(url)
    .bearer_auth(token)
    .json(&write)
    .send()
    .await;
  match resp {
    Ok(r) if r.status().is_success() => (StatusCode::OK, Json(json!({ "ok": true }))).into_response(),
    Ok(r) => {
      let status = r.status();
      let t = r.text().await.unwrap_or_default();
      (
        StatusCode::INTERNAL_SERVER_ERROR,
        Json(json!({ "ok": false, "error": format!("ban write http {} {}", status, t) })),
      )
        .into_response()
    }
    Err(e) => (
      StatusCode::INTERNAL_SERVER_ERROR,
      Json(json!({ "ok": false, "error": format!("ban write error: {e}") })),
    )
      .into_response(),
  }
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

async fn fetch_service_account_email(http: &reqwest::Client) -> anyhow::Result<String> {
  let resp = http
    .get("http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/email")
    .header("Metadata-Flavor", "Google")
    .send()
    .await?;
  let status = resp.status();
  let email = resp.text().await.unwrap_or_default();
  if !status.is_success() {
    anyhow::bail!("metadata email http {}", status);
  }
  let email = email.trim().to_string();
  if email.is_empty() {
    anyhow::bail!("missing service account email");
  }
  Ok(email)
}

fn build_bucket_candidates(bucket: &str, project_id: &str) -> Vec<String> {
  let bucket = bucket.trim();
  let project_id = project_id.trim();

  let mut candidates: Vec<String> = Vec::new();
  if !bucket.is_empty() {
    candidates.push(bucket.to_string());
    if bucket.ends_with(".firebasestorage.app") {
      candidates.push(
        bucket
          .trim_end_matches(".firebasestorage.app")
          .to_string()
          + ".appspot.com",
      );
    }
  }
  if !project_id.is_empty() {
    candidates.push(format!("{project_id}.appspot.com"));
    candidates.push(format!("{project_id}.firebasestorage.app"));
  }

  candidates.retain(|b| !b.trim().is_empty());
  candidates.dedup();
  candidates
}

fn gcs_media_url(bucket: &str, object_name: &str) -> String {
  let encoded_object =
    utf8_percent_encode(object_name, percent_encoding::NON_ALPHANUMERIC).to_string();
  format!(
    "https://storage.googleapis.com/storage/v1/b/{}/o/{}?alt=media",
    bucket, encoded_object
  )
}

async fn gcs_stream_object(
  http: &reqwest::Client,
  token: &str,
  bucket: &str,
  object_name: &str,
  request_headers: &HeaderMap,
) -> anyhow::Result<Option<axum::response::Response>> {
  let bucket = bucket.trim();
  if bucket.is_empty() {
    return Ok(None);
  }

  let url = gcs_media_url(bucket, object_name);
  let mut req = http.get(url).bearer_auth(token);
  if let Some(v) = request_headers.get(header::RANGE) {
    req = req.header(header::RANGE, v);
  }
  if let Some(v) = request_headers.get(header::IF_NONE_MATCH) {
    req = req.header(header::IF_NONE_MATCH, v);
  }
  if let Some(v) = request_headers.get(header::IF_MODIFIED_SINCE) {
    req = req.header(header::IF_MODIFIED_SINCE, v);
  }
  if let Some(v) = request_headers.get(header::IF_MATCH) {
    req = req.header(header::IF_MATCH, v);
  }
  if let Some(v) = request_headers.get(header::IF_RANGE) {
    req = req.header(header::IF_RANGE, v);
  }

  let upstream = req.send().await?;
  let status = upstream.status();
  if status.as_u16() == 404 {
    return Ok(None);
  }
  if status.as_u16() == 304 {
    let mut builder = axum::response::Response::builder().status(status);
    for h in [
      header::CACHE_CONTROL,
      header::ETAG,
      header::LAST_MODIFIED,
    ] {
      if let Some(v) = upstream.headers().get(&h) {
        builder = builder.header(h, v);
      }
    }
    let resp = builder.body(axum::body::Body::empty())?;
    return Ok(Some(resp));
  }
  if !status.is_success() && status.as_u16() != 206 {
    let t = upstream.text().await.unwrap_or_default();
    anyhow::bail!("upstream http {} {}", status, t);
  }

  let mut builder = axum::response::Response::builder().status(status);
  for h in [
    header::CONTENT_TYPE,
    header::CONTENT_LENGTH,
    header::CACHE_CONTROL,
    header::CONTENT_RANGE,
    header::ACCEPT_RANGES,
    header::ETAG,
    header::LAST_MODIFIED,
  ] {
    if let Some(v) = upstream.headers().get(&h) {
      builder = builder.header(h, v);
    }
  }

  let stream = upstream
    .bytes_stream()
    .map_err(|e| std::io::Error::new(std::io::ErrorKind::Other, e));
  let body = axum::body::Body::from_stream(stream);
  let resp = builder.body(body)?;
  Ok(Some(resp))
}

#[derive(Debug, Deserialize)]
struct GcsListResponse {
  #[serde(default)]
  items: Vec<GcsObject>,
  #[serde(default)]
  nextPageToken: String,
}

#[derive(Debug, Deserialize)]
struct GcsObject {
  #[serde(default)]
  name: String,
}

async fn gcs_list_objects(
  http: &reqwest::Client,
  token: &str,
  bucket: &str,
  prefix: &str,
) -> anyhow::Result<Vec<String>> {
  let prefix = prefix.trim();
  if prefix.is_empty() {
    return Ok(Vec::new());
  }

  let mut out: Vec<String> = Vec::new();
  let mut page_token: Option<String> = None;

  loop {
    let mut url = format!(
      "https://storage.googleapis.com/storage/v1/b/{}/o?prefix={}&fields=items(name),nextPageToken&maxResults=1000",
      utf8_percent_encode(bucket, URL_ENCODE_SET),
      utf8_percent_encode(prefix, URL_ENCODE_SET)
    );
    if let Some(t) = &page_token {
      url.push_str("&pageToken=");
      url.push_str(&utf8_percent_encode(t, URL_ENCODE_SET).to_string());
    }

    let resp = http.get(url).bearer_auth(token).send().await?;
    let status = resp.status();
    if status.as_u16() == 404 {
      return Ok(Vec::new());
    }
    let json: GcsListResponse = resp.json().await.unwrap_or(GcsListResponse {
      items: Vec::new(),
      nextPageToken: String::new(),
    });
    if !status.is_success() {
      anyhow::bail!("list http {}", status);
    }

    for item in json.items {
      if !item.name.trim().is_empty() {
        out.push(item.name);
      }
    }

    let next = json.nextPageToken.trim().to_string();
    if next.is_empty() {
      break;
    }
    page_token = Some(next);
  }

  Ok(out)
}

fn zip_entry_name(prefix: &str, object_name: &str) -> String {
  let mut rel = object_name.strip_prefix(prefix).unwrap_or(object_name);
  rel = rel.trim_start_matches('/');
  let parts: Vec<&str> = rel.split('/').filter(|p| !p.is_empty()).collect();
  if parts.is_empty() {
    return String::new();
  }

  let mut out_parts: Vec<String> = Vec::with_capacity(parts.len());
  for (idx, part) in parts.iter().enumerate() {
    if idx == parts.len().saturating_sub(1) {
      out_parts.push(strip_upload_unique_prefix(part).to_string());
    } else {
      out_parts.push((*part).to_string());
    }
  }
  out_parts.join("/")
}

fn strip_upload_unique_prefix(file_name: &str) -> &str {
  if let Some(i) = file_name.find('_') {
    let rest = &file_name[i + 1..];
    if !rest.trim().is_empty() {
      return rest;
    }
  }
  file_name
}

async fn gcs_signed_url_v4(
  http: &reqwest::Client,
  token: &str,
  service_account_email: &str,
  bucket: &str,
  object_name: &str,
  expires_seconds: u32,
) -> anyhow::Result<String> {
  use base64::Engine;
  use sha2::Digest;
  use time::format_description;

  let now = time::OffsetDateTime::now_utc();
  let date = now.format(&format_description::parse("[year][month][day]")?)?;
  let datetime = now.format(&format_description::parse("[year][month][day]T[hour][minute][second]Z")?)?;

  let scope = format!("{date}/auto/storage/goog4_request");
  let credential = format!("{service_account_email}/{scope}");

  let host = "storage.googleapis.com";
  let canonical_uri = gcs_canonical_uri(bucket, object_name);

  let mut query_params: Vec<(String, String)> = vec![
    ("X-Goog-Algorithm".to_string(), "GOOG4-RSA-SHA256".to_string()),
    ("X-Goog-Credential".to_string(), credential),
    ("X-Goog-Date".to_string(), datetime.clone()),
    ("X-Goog-Expires".to_string(), expires_seconds.to_string()),
    ("X-Goog-SignedHeaders".to_string(), "host".to_string()),
  ];
  query_params.sort_by(|a, b| a.0.cmp(&b.0).then_with(|| a.1.cmp(&b.1)));
  let canonical_query = query_params
    .iter()
    .map(|(k, v)| {
      format!(
        "{}={}",
        utf8_percent_encode(k, URL_ENCODE_SET),
        utf8_percent_encode(v, URL_ENCODE_SET)
      )
    })
    .collect::<Vec<_>>()
    .join("&");

  let canonical_headers = format!("host:{host}\n");
  let signed_headers = "host";
  let payload_hash = "UNSIGNED-PAYLOAD";

  let canonical_request = format!(
    "GET\n{canonical_uri}\n{canonical_query}\n{canonical_headers}\n{signed_headers}\n{payload_hash}"
  );
  let canonical_request_hash = hex::encode(sha2::Sha256::digest(canonical_request.as_bytes()));

  let string_to_sign = format!(
    "GOOG4-RSA-SHA256\n{datetime}\n{scope}\n{canonical_request_hash}"
  );

  let payload = base64::engine::general_purpose::STANDARD.encode(string_to_sign.as_bytes());
  let sign_url = format!(
    "https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/{}:signBlob",
    utf8_percent_encode(service_account_email, URL_ENCODE_SET)
  );
  let resp = http
    .post(sign_url)
    .bearer_auth(token)
    .json(&json!({ "payload": payload }))
    .send()
    .await?;
  let status = resp.status();
  let json: serde_json::Value = resp.json().await.unwrap_or(json!({}));
  if !status.is_success() {
    anyhow::bail!("signBlob http {}", status);
  }
  let signed_blob = json
    .get("signedBlob")
    .and_then(|v| v.as_str())
    .unwrap_or("")
    .to_string();
  if signed_blob.is_empty() {
    anyhow::bail!("missing signedBlob");
  }
  let sig_bytes = base64::engine::general_purpose::STANDARD
    .decode(signed_blob.as_bytes())
    .map_err(|e| anyhow::anyhow!("base64 decode: {e}"))?;
  let signature_hex = hex::encode(sig_bytes);

  Ok(format!(
    "https://{host}{canonical_uri}?{canonical_query}&X-Goog-Signature={signature_hex}"
  ))
}

fn gcs_canonical_uri(bucket: &str, object_name: &str) -> String {
  let mut parts: Vec<String> = Vec::new();
  parts.push(utf8_percent_encode(bucket.trim(), URL_ENCODE_SET).to_string());
  for seg in object_name.split('/') {
    if seg.is_empty() {
      continue;
    }
    parts.push(utf8_percent_encode(seg, URL_ENCODE_SET).to_string());
  }
  format!("/{}", parts.join("/"))
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

  let client_key = obj
    .get("clientKey")
    .and_then(|v| v.as_str())
    .unwrap_or("")
    .trim()
    .to_string();
  if !client_key.is_empty() {
    fields.insert("clientKey".to_string(), fs_string(&client_key));
  }

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
    .allow_headers([
      header::CONTENT_TYPE,
      header::AUTHORIZATION,
      header::RANGE,
      header::IF_NONE_MATCH,
      header::IF_MODIFIED_SINCE,
      header::IF_MATCH,
      header::IF_RANGE,
      HeaderName::from_static("x-admin-key"),
    ]);

  let app = axum::Router::new()
    .route("/", get(root))
    .route("/health", get(healthz))
    .route("/healthz", get(healthz))
    .route("/v1/comments", post(add_comment))
    .route("/v1/ban", post(ban_user))
    .route("/v1/download", get(download_proxy))
    .route("/v1/zip", get(zip_folder))
    .route("/v1/signed-url", get(signed_url))
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
