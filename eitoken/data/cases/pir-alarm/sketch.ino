// EI TOKEN 案例 · 有人来了报警
// 人体感应到有人经过，灯亮蜂鸣器响
// 适用：Arduino Uno / Arduino Nano / ESP32 DevKit / ESP32-S3 DevKitC

#if defined(CONFIG_IDF_TARGET_ESP32S3)
const int PIR_PIN = 4;
const int BUZZER_PIN = 17;
const int LED_PIN = 2;
#elif defined(ESP32)
const int PIR_PIN = 4;
const int BUZZER_PIN = 25;
const int LED_PIN = 2;
#else
const int PIR_PIN = 2;
const int BUZZER_PIN = 8;
const int LED_PIN = 13;
#endif

int last = LOW;

void setup() {
  Serial.begin(115200);
  pinMode(PIR_PIN, INPUT);
  pinMode(LED_PIN, OUTPUT);
  Serial.println("EIT pir-alarm ready");
}

void loop() {
  int now = digitalRead(PIR_PIN);
  if (now != last) {
    last = now;
    if (now == HIGH) { Serial.println("motion detected"); digitalWrite(LED_PIN, HIGH); tone(BUZZER_PIN, 1800, 300); }
    else             { Serial.println("clear");           digitalWrite(LED_PIN, LOW); }
  }
  delay(50);
}
