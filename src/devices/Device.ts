import { DataStreamTrack } from "../DataStreamTrack";
import { DataStream } from "../DataStream";
import { CoreDeviceType, DeviceConfig } from "../types/Devices.types";
import {randomUUID} from "../common/id";


export class Device <T> {

    id: string = randomUUID()
    _ondata: (data:any, timestamps?:any, name?: string) => (any[] | {[x : string]: any}) = (data) => data
    constraints: DeviceConfig<T>
    device: CoreDeviceType<T>
    stream?: DataStream
    encoder: TextEncoder | any
    decoder: TextDecoder | any
    active: boolean = false
    options: DeviceConfig<T>[]
    debug: boolean = false
    // coordinates: any[] = []
    

    // // Inherited Functions
    // onconnect: (target) =>{}
    // ondisconnect: (target) =>{}}

    constructor(constraints: DeviceConfig<T> | DeviceConfig<T>[]){

        // Auto-select first constraint in an array
        if (Array.isArray(constraints)){
            this.constraints = constraints[0]
            this.options = [...constraints]
        } else {
            this.constraints = constraints
            this.options = [constraints]
        }

        this.device = (this.constraints.device) ? new this.constraints.device(this.constraints) : this
        this.stream = this.constraints.stream
        this.debug = this.constraints.debug ?? false

        // -------------- Set Default Constraints --------------

        this.init(this.constraints)
    }


    init = (constraints?: Partial<DeviceConfig>) => {

        // Disconnect Active Device
        if (this.active) this.disconnect()
        
        // Assign Constraints
        if (constraints) {

            Object.assign(this.constraints, constraints) // Replace new constraints

            //  Callbacks 
            this.onconnect = this.constraints.onconnect ?? this.onconnect;
            this.ondisconnect = this.constraints.ondisconnect ?? this.ondisconnect;
            if (this.constraints.ondata) this._ondata = this.constraints.ondata

            this.onerror = this.constraints.onerror ?? this.onerror;

            if (this.constraints.encode instanceof Function) this.encode = this.constraints.encode 
            else this.encoder = new TextEncoder();

            if (this.constraints.decode instanceof Function) this.decode = this.constraints.decode 
            else this.decoder = new TextDecoder("utf-8");


            if (this.constraints.oninit instanceof Function) this.oninit = this.constraints.oninit

        }

        // Run Callback
        this.oninit(this)
    }

    // setCoordinates = (input:any[]) => {
    //     if (Array.isArray(input)) this.coordinates = input
    // }
   
    // Core Methods 
    connect = async () => {

        if (!(this.device instanceof Device) && this.device.connect) await this.device.connect()
        this.active = true
        this._connect()
        this.onconnect(this)
    }        

    disconnect = async () => {
        if (!(this.device instanceof Device) && this.device.disconnect) await this.device.disconnect()
        this.active = false
        this.stream?.tracks.forEach((t:DataStreamTrack | MediaStreamTrack) => this.stream?.removeTrack(t as any))
        this._disconnect()
        this.ondisconnect(this)
    }

    _connect = async () => { }
    _disconnect = async () => { }

    send = async (msg:any,from:any):Promise<any> => {this.onsend(msg,from)}

    // Auxilliary Methods
    encode = (msg:any, _:string) => this.encoder.encode(msg)
    decode = (msg:any, _:string) => this.decoder.decode(msg)

    // Events
    oninit = async (_:Device<T> = this) => {}
    onconnect = async (target:Device<T> = this) => (this.debug) ? console.log(`${target.constructor.name} connected!`) : {}

    ondisconnect = async (target:Device<T> = this) => (this.debug) ? console.log(`${target.constructor.name} disconnected!`) : {}

    onsend = async (msg?:any, from?:any) => (this.debug) ? console.log(`Sent ${msg} from ${from}`) : {}
    onerror = async (err:Error) => (this.debug) ? console.log(`${this.constructor.name} Error: ${err}`) : {}

    // --------------- Internal Methods ---------------
    ondata = (data:any, timestamps:any=[Date.now()], charName?:string) => {

            // Run Data through Decoder Function
            if (this._ondata instanceof Function){
            let obj = this._ondata(data, charName) // returns array
            
            // Add DataStreamTrack for each Data Channel
            if (this.stream){
                
                const keys = Object.keys(obj)

                keys.forEach((key:(string | number)) => {
                    if (this.stream){

                        let track = this.stream.tracks.get(key) ?? this._createTrack(String(key))

                        if (track instanceof DataStreamTrack) track.addData((obj as any)[key], timestamps)
                    }
                })

            }
        }

    }

    private _createTrack = (contentHint?: string) => {
        if (this.stream){
            const newTrack = new DataStreamTrack(this, undefined, contentHint)
            return this.stream.addTrack(newTrack)
        } else return undefined
    }

}