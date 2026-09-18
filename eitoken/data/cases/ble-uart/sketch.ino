// EI TOKEN 案例 · 蓝牙串口遥控
// 手机蓝牙调试 App 发 on / off，控制板子上的灯
// 适用：ESP32 DevKit / ESP32-S3 DevKitC

const int LED_PIN = 2;

#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>

#define SVC_UUID "6E400001-B5A3-F393-E0A9-E50E24DCCA9E"   // Nordic UART 服务
#define RX_UUID  "6E400002-B5A3-F393-E0A9-E50E24DCCA9E"
#define TX_UUID  "6E400003-B5A3-F393-E0A9-E50E24DCCA9E"

BLECharacteristic* txChar;

class RxHandler : public BLECharacteristicCallbacks {
  void onWrite(BLECharacteristic* c) override {
    String cmd = String(c->getValue().c_str());
    cmd.trim();
    if (cmd == "on")  { digitalWrite(LED_PIN, HIGH); txChar->setValue("LED ON");  txChar->notify(); Serial.println("LED ON"); }
    if (cmd == "off") { digitalWrite(LED_PIN, LOW);  txChar->setValue("LED OFF"); txChar->notify(); Serial.println("LED OFF"); }
  }
};

void setup() {
  Serial.begin(115200);
  pinMode(LED_PIN, OUTPUT);
  BLEDevice::init("EITOKEN-BLE");
  BLEServer* server = BLEDevice::createServer();
  BLEService* svc = server->createService(SVC_UUID);
  txChar = svc->createCharacteristic(TX_UUID, BLECharacteristic::PROPERTY_NOTIFY);
  txChar->addDescriptor(new BLE2902());
  BLECharacteristic* rx = svc->createCharacteristic(RX_UUID, BLECharacteristic::PROPERTY_WRITE);
  rx->setCallbacks(new RxHandler());
  svc->start();
  BLEDevice::getAdvertising()->addServiceUUID(SVC_UUID);
  BLEDevice::startAdvertising();
  Serial.println("EIT ble-uart ready");
  Serial.println("BLE advertising as EITOKEN-BLE");
}

void loop() {
  delay(1000);
}
