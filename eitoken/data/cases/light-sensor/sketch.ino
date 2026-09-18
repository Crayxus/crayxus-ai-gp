// EI TOKEN 案例 · 天黑自动开灯
// 光线变暗时，灯自己亮起来
// 适用：Arduino Uno / Arduino Nano / ESP32 DevKit / ESP32-S3 DevKitC

#if defined(CONFIG_IDF_TARGET_ESP32S3)
const int LDR_PIN = 1;
const int LED_PIN = 2;
#elif defined(ESP32)
const int LDR_PIN = 34;
const int LED_PIN = 2;
#else
const int LDR_PIN = A0;
const int LED_PIN = 13;
#endif

#if defined(ESP32)
const int ADC_MAX = 4095;   // ESP32 的 ADC 是 12 位
#else
const int ADC_MAX = 1023;   // Uno/Nano 的 ADC 是 10 位
#endif

bool on = false;

void setup() {
  Serial.begin(115200);
  pinMode(LED_PIN, OUTPUT);
  Serial.println("EIT light-sensor ready");
}

void loop() {
  int raw = analogRead(LDR_PIN);
  int pct = map(raw, 0, ADC_MAX, 0, 100);   // 常见模块：越暗读数越大
  if (!on && pct > 60) { on = true;  digitalWrite(LED_PIN, HIGH); Serial.println("dark -> LED ON"); }
  if (on && pct < 50)  { on = false; digitalWrite(LED_PIN, LOW);  Serial.println("bright -> LED OFF"); }   // 回差 10%
  Serial.print("light "); Serial.println(pct);
  delay(300);
}
