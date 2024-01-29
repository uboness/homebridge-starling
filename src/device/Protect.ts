import { PlatformAccessory, Service } from 'homebridge';
import { isBoolean, isString } from '../common.js';
import { Starling } from '../Starling.js';
import { StarlingHub } from '../StarlingHub.js';
import { StarlingPlatform } from '../StarlingPlatform.js';
import { StarlingDevice } from './StarlingDevice.js';

export class Protect extends StarlingDevice<Starling.Protect> {

    static readonly create = async (platform: StarlingPlatform, hub: StarlingHub, accessory: PlatformAccessory, device: Starling.Device): Promise<Protect> => {
        return new Protect(platform, hub, accessory, <Starling.Protect>device);
    }

    private co?: Service;
    private motion?: Service;
    private battery?: Service;

    private constructor(platform: StarlingPlatform, hub: StarlingHub, accessory: PlatformAccessory, device: Starling.Protect) {
        super(platform, hub, accessory, device, accessory.getService(platform.Service.SmokeSensor) ?? accessory.addService(platform.Service.SmokeSensor));

        this.service.getCharacteristic(platform.Characteristic.SmokeDetected)
            .setValue(this.device.smokeDetected);

        if (isBoolean(this.device.coDetected)) {
            this.co = accessory.getService(platform.Service.CarbonMonoxideSensor) ?? accessory.addService(platform.Service.CarbonMonoxideSensor);
            this.co.getCharacteristic(platform.Characteristic.CarbonMonoxideDetected)
                .setValue(this.device.coDetected);
        }

        if (isBoolean(this.device.occupancyDetected)) {
            this.motion = accessory.getService(platform.Service.MotionSensor) ?? accessory.addService(platform.Service.MotionSensor);
            this.service.getCharacteristic(platform.Characteristic.MotionDetected)
                .setValue(this.device.occupancyDetected);
        }

        if (isString(device.batteryStatus)) {
            this.battery = accessory.getService(platform.Service.Battery) ?? accessory.addService(platform.Service.Battery);
            this.battery.getCharacteristic(platform.Characteristic.StatusLowBattery)
                .setValue(device.batteryStatus === 'normal' ? 0 : 1)
                .onGet(() => this.device.batteryStatus === 'normal' ? 0 : 1);
        }
    }

    update(protect: Starling.Protect) {
        this.device = protect;
        if (isBoolean(protect.smokeDetected)) {
            this.service.updateCharacteristic(this.platform.Characteristic.SmokeDetected, protect.smokeDetected);
        }
        if (isString(protect.coDetected) && this.co) {
            this.co.updateCharacteristic(this.platform.Characteristic.CarbonMonoxideDetected, protect.coDetected);
        }
        if (isString(protect.occupancyDetected) && this.motion) {
            this.motion.updateCharacteristic(this.platform.Characteristic.MotionDetected, protect.occupancyDetected);
        }
        if (isString(protect.batteryStatus) && this.battery) {
            this.battery.updateCharacteristic(this.platform.Characteristic.StatusLowBattery, protect.batteryStatus === 'normal' ? 0 : 1);
        }
    }

    async close(){
    }

}
