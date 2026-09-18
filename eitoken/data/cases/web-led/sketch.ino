// EI TOKEN 案例 · 手机网页开关灯
// 手机打开网页，点按钮控制板子上的灯
// 适用：ESP32 DevKit / ESP32-S3 DevKitC

const int LED_PIN = 2;

#include <WiFi.h>
#include <WebServer.h>

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

WebServer server(80);
bool ledOn = false;

String page() {
  String s = "<!doctype html><meta name=viewport content='width=device-width'><style>body{font-family:sans-serif;text-align:center;padding:40px}a{display:block;margin:16px auto;padding:18px;width:200px;border-radius:14px;color:#fff;text-decoration:none;font-size:22px}</style>";
  s += "<h2>EI TOKEN 灯</h2><p>现在：" + String(ledOn ? "亮" : "灭") + "</p>";
  s += "<a href='/on' style='background:#22D3EE'>开灯</a><a href='/off' style='background:#8B5CF6'>关灯</a>";
  return s;
}

void setup() {
  Serial.begin(115200);
  pinMode(LED_PIN, OUTPUT);
  Serial.println("EIT web-led ready");
  if (!connectWiFi()) return;
  server.on("/", []() { server.send(200, "text/html; charset=utf-8", page()); });
  server.on("/on", []() { ledOn = true;  digitalWrite(LED_PIN, HIGH); Serial.println("LED ON");  server.send(200, "text/html; charset=utf-8", page()); });
  server.on("/off", []() { ledOn = false; digitalWrite(LED_PIN, LOW);  Serial.println("LED OFF"); server.send(200, "text/html; charset=utf-8", page()); });
  server.begin();
  Serial.println("open the IP above in your phone browser");
}

void loop() {
  server.handleClient();
}
