// EI TOKEN 案例 · 联网自动对时
// 连上网自动获取北京时间，每秒打印一次
// 适用：ESP32 DevKit / ESP32-S3 DevKitC

#include <WiFi.h>
#include <time.h>

// ⚠️ 改成你的 WiFi（只支持 2.4G）
const char* WIFI_SSID = "your-wifi";
const char* WIFI_PASS = "your-password";

bool connectWiFi() {
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  Serial.print("connecting");
  for (int i = 0; i < 40 && WiFi.status() != WL_CONNECTED; i++) { delay(500); Serial.print("."); }
  Serial.println();
  if (WiFi.status() != WL_CONNECTED) { Serial.println("WiFi failed: check SSID/password, 2.4G only"); return false; }
  Serial.print("IP "); Serial.println(WiFi.localIP());
  return true;
}

void setup() {
  Serial.begin(115200);
  Serial.println("EIT ntp-clock ready");
  if (!connectWiFi()) return;
  configTime(8 * 3600, 0, "ntp.aliyun.com", "pool.ntp.org");   // 东八区
}

void loop() {
  struct tm t;
  if (getLocalTime(&t, 2000)) {
    char buf[32];
    strftime(buf, sizeof(buf), "%Y-%m-%d %H:%M:%S", &t);
    Serial.print("time "); Serial.println(buf);
  } else {
    Serial.println("waiting for NTP...");
  }
  delay(1000);
}
