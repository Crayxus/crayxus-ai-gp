// EI TOKEN 案例 · 温湿度计
// 用 DHT22 读出房间温度和湿度
// 适用：Arduino Uno / Arduino Nano / ESP32 DevKit / ESP32-S3 DevKitC

#if defined(CONFIG_IDF_TARGET_ESP32S3)
const int DHT_PIN = 4;
#elif defined(ESP32)
const int DHT_PIN = 4;
#else
const int DHT_PIN = 2;
#endif

#include <DHT.h>

DHT dht(DHT_PIN, DHT22);   // 用 DHT11 就改成 DHT11

void setup() {
  Serial.begin(115200);
  dht.begin();
  Serial.println("EIT dht-weather ready");
}

void loop() {
  delay(2000);   // DHT22 至少间隔 2 秒
  float t = dht.readTemperature();
  float h = dht.readHumidity();
  if (isnan(t) || isnan(h)) { Serial.println("read failed, check wiring"); return; }
  Serial.print("temp "); Serial.print(t, 1); Serial.print(" C  humidity "); Serial.print(h, 1); Serial.println(" %");
}
