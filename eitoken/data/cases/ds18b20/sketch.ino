// EI TOKEN 案例 · 防水温度探头
// DS18B20 探头测水温、土温都行
// 适用：Arduino Uno / Arduino Nano / ESP32 DevKit / ESP32-S3 DevKitC

#if defined(CONFIG_IDF_TARGET_ESP32S3)
const int ONEWIRE_PIN = 4;
#elif defined(ESP32)
const int ONEWIRE_PIN = 4;
#else
const int ONEWIRE_PIN = 2;
#endif

#include <OneWire.h>
#include <DallasTemperature.h>

OneWire oneWire(ONEWIRE_PIN);
DallasTemperature sensors(&oneWire);

void setup() {
  Serial.begin(115200);
  sensors.begin();
  Serial.println("EIT ds18b20 ready");
  Serial.print("found "); Serial.print(sensors.getDeviceCount()); Serial.println(" sensor(s)");
}

void loop() {
  sensors.requestTemperatures();
  float t = sensors.getTempCByIndex(0);
  if (t == DEVICE_DISCONNECTED_C) Serial.println("sensor not found, check 4.7k pull-up");
  else { Serial.print("temp "); Serial.print(t, 2); Serial.println(" C"); }
  delay(1000);
}
