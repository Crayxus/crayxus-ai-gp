// EI TOKEN 案例 · 数据上云（MQTT）
// 每 5 秒把芯片温度发到公共 MQTT 服务器
// 适用：ESP32 DevKit / ESP32-S3 DevKitC

#include <WiFi.h>
#include <PubSubClient.h>

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

const char* BROKER = "broker.emqx.io";
WiFiClient net;
PubSubClient mqtt(net);
String topic;

void setup() {
  Serial.begin(115200);
  Serial.println("EIT mqtt-report ready");
  if (!connectWiFi()) return;
  topic = "eitoken/" + String((uint32_t)ESP.getEfuseMac(), HEX) + "/temp";
  mqtt.setServer(BROKER, 1883);
  Serial.print("topic "); Serial.println(topic);
}

void loop() {
  if (WiFi.status() != WL_CONNECTED) { delay(1000); return; }
  if (!mqtt.connected()) {
    String id = "eit-" + String(random(0xffff), HEX);
    if (mqtt.connect(id.c_str())) Serial.println("mqtt connected");
    else { Serial.print("mqtt failed rc="); Serial.println(mqtt.state()); delay(2000); return; }
  }
  mqtt.loop();
  static unsigned long last = 0;
  if (millis() - last > 5000) {
    last = millis();
    String payload = String(temperatureRead(), 1);
    mqtt.publish(topic.c_str(), payload.c_str());
    Serial.print("published "); Serial.println(payload);
  }
}
