// BluetoothDevice modified from this sparkfun tutorial: https://learn.sparkfun.com/tutorials/esp32-ota-updates-over-ble-from-a-react-web-application/all
// Joshua Brewster and Garrett Flynn, November 2021 (AGPL License)


//See original copyright:
/*************************************************** 
 This is a React WebApp written to Flash an ESP32 via BLE

Written by Andrew England (SparkFun)
BSD license, all text above must be included in any redistribution.
*****************************************************/
import {Device} from "./Device"
import { DeviceConstraintsType } from '../types/Devices.types';

export class Bluetooth<T=any> extends Device<T> { //This is formatted for the way the HEG sends/receives information. Other BLE devices will likely need changes to this to be interactive.
    
            // Device-Specific Properties
            source?: BluetoothDevice
            characteristics: {
                [x: string]: BluetoothRemoteGATTCharacteristic
            } = {};
    
            // Generic Properties
            server?: BluetoothRemoteGATTServer;
            service?: BluetoothRemoteGATTService;
            transmitCharacteristic?: BluetoothRemoteGATTCharacteristic;
                    
    constructor(constraints: DeviceConstraintsType) {
        super(constraints)
    }

    // ---------------------- CORE ----------------------

    connect = async (): Promise<void> => { //Must be run by button press or user-initiated call
        let serviceUUID = (typeof this.constraints.serviceUUID === 'string') ? this.constraints.serviceUUID.toLowerCase() : this.constraints.serviceUUID
        
        let filters = []
        if (serviceUUID) filters.push({ services: [serviceUUID] })
        if (this.constraints.namePrefix) filters.push({ namePrefix: this.constraints.namePrefix })

        await navigator.bluetooth.requestDevice({
            filters
        })
            .then((source:BluetoothDevice)=> {
                    this.source = source;
                    let gatt = source.gatt
                    if (gatt) return gatt.connect(); //Connect to HEG
                    else return Promise.reject();
            })
            .then((server: BluetoothRemoteGATTServer) => {

                if (serviceUUID){
                    this.server = server
                    return server.getPrimaryService(serviceUUID)
                } else return Promise.reject();
            })
            .then(async (service: BluetoothRemoteGATTService) => {

                this.service = service;
                if (this.source) this.source.addEventListener('gattserverdisconnected', () => {this.ondisconnect(this)});

                for (let name in this.constraints.characteristics) await this.connectCharacteristic(name, this.constraints.characteristics[name])
                this.onconnect(this);
            })
            .catch(err => { console.error(err); this.onerror(err); return Promise.reject(); });
    }

    _disconnect = async () => {
        this.server?.disconnect();
    };

    send = async (msg:any, charName:any) => {
        if (this.transmitCharacteristic) return this.transmitCharacteristic.writeValue(this.encode(msg, charName));
    }

    // ---------------------- CALLBACKS ----------------------

    onnotification = (e:any, charName:string) => {
        this.ondata(this.decode(e.target.value, charName), charName)
    }

    // ---------------------- INTERNAL UTILITIES ----------------------


    connectCharacteristic = async (name:string, value:any):Promise<any> => {
        if (Array.isArray(value)) await Promise.all(value.map((val, i) => this.connectCharacteristic(`${name}${i}`, val)))
        else {
            value = (typeof value === 'string') ?  value.toLowerCase() : value

            if (this.service){
                const characteristic = await this.service.getCharacteristic(value);

                this.characteristics[name] = characteristic

                let props = characteristic.properties
                
                // Assign to Write to this Characteristic
                if (props.write || props.writeWithoutResponse){ 
                    this.transmitCharacteristic = characteristic
                }

                // Start Notifications
                if (props.notify){
                    characteristic.addEventListener('characteristicvaluechanged', (e:Event) => {
                        this.onnotification(e,name)
                    })
                    return characteristic.startNotifications()
                } 
            }
        }
    }
}