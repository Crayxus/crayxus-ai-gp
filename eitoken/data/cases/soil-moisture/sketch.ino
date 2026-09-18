// EI TOKEN 案例 · 花盆缺水提醒
// 土壤太干时亮灯提醒你浇水
// 适用：Arduino Uno / Arduino Nano / ESP32 DevKit / ESP32-S3 DevKitC

#if defined(CONFIG_IDF_TARGET_ESP32S3)
const int SOIL_PIN = 1;
const int LED_PIN = 2;
#elif defined(ESP32)
const int SOIL_PIN = 34;
const int LED_PIN = 2;
#else
const int SOIL_PIN = A0;
const int LED_PIN = 13;
#endif

#if defined(ESP32)
const int ADC_MAX = 4095;   // ESP32 的 ADC 是 12 位
#else
const int ADC_MAX = 1023;   // Uno/Nano 的 ADC 是 10 位
#endif

// 标定：放在空气里读到的值填 DRY，泡在水里读到的值填 WET
#if defined(ESP32)
const int DRY = 3300, WET = 1400;
#else
const int DRY = 520, WET = 260;
#endif

void setup() {
  Serial.begin(115200);
  pinMode(LED_PIN, OUTPUT);
  Serial.println("EIT soil-moisture ready");
}

void loop() {
  int raw = analogRead(SOIL_PIN);
  int pct = constrain(map(raw, DRY, WET, 0, 100), 0, 100);
  digitalWrite(LED_PIN, pct < 30 ? HIGH : LOW);   // 低于 30% 亮灯提醒
  Serial.print("soil "); Serial.print(pct); Serial.print(" %  raw "); Serial.println(raw);
  delay(1000);
}
