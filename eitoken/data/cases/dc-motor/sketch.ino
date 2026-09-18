// EI TOKEN 案例 · 直流电机调速
// 用 L298N / TB6612 让电机正转、反转、调速
// 适用：Arduino Uno / Arduino Nano / ESP32 DevKit / ESP32-S3 DevKitC

#if defined(CONFIG_IDF_TARGET_ESP32S3)
const int EN_PIN = 7;
const int IN1_PIN = 16;
const int IN2_PIN = 17;
#elif defined(ESP32)
const int EN_PIN = 18;
const int IN1_PIN = 23;
const int IN2_PIN = 25;
#else
const int EN_PIN = 5;
const int IN1_PIN = 7;
const int IN2_PIN = 8;
#endif

void drive(int speed) {   // -255 ~ 255，正数正转
  digitalWrite(IN1_PIN, speed >= 0 ? HIGH : LOW);
  digitalWrite(IN2_PIN, speed >= 0 ? LOW : HIGH);
  analogWrite(EN_PIN, abs(speed));
}

void setup() {
  Serial.begin(115200);
  pinMode(EN_PIN, OUTPUT); pinMode(IN1_PIN, OUTPUT); pinMode(IN2_PIN, OUTPUT);
  Serial.println("EIT dc-motor ready");
}

void loop() {
  Serial.println("forward"); for (int s = 0; s <= 255; s += 5) { drive(s); delay(20); } delay(1000);
  Serial.println("stop");    drive(0); delay(800);
  Serial.println("reverse"); for (int s = 0; s >= -200; s -= 5) { drive(s); delay(20); } delay(1000);
  Serial.println("stop");    drive(0); delay(800);
}
