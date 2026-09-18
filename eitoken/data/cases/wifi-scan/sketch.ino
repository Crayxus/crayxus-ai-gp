// EI TOKEN 案例 · 扫描附近 WiFi
// 列出周围所有 WiFi 的名字和信号强度
// 适用：ESP32 DevKit / ESP32-S3 DevKitC

#include <WiFi.h>

void setup() {
  Serial.begin(115200);
  WiFi.mode(WIFI_STA);
  WiFi.disconnect();
  delay(100);
  Serial.println("EIT wifi-scan ready");
}

void loop() {
  int n = WiFi.scanNetworks();
  Serial.print(n); Serial.println(" networks");
  for (int i = 0; i < n; i++) {
    Serial.print("  "); Serial.print(WiFi.SSID(i));
    Serial.print("  "); Serial.print(WiFi.RSSI(i)); Serial.println(" dBm");
  }
  WiFi.scanDelete();
  delay(8000);
}
