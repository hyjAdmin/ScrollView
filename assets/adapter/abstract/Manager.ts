const { ccclass, property } = cc._decorator;
import { ScrollAdapter } from '../ScrollAdapter';
import { View } from './View';
interface IResult {
    params: any[]
    return: any
}

interface EventInfo {
    callback: Function
    target: any
    once: boolean
}
export interface IParams {
    [key: number | string]: IResult
}
@ccclass
export abstract class Manager<TEvent extends number | string = any, TParams extends IParams = any>  {
    private _adapter: ScrollAdapter
    get adapter() { return this._adapter }
    private _eventMap: Map<TEvent, EventInfo[]> = new Map()
    private _inited: boolean = false
    protected abstract onInit(): void
    private create(adapter: ScrollAdapter) {
        this._adapter = adapter
    }
    private init() {
        if (!this._inited) {
            this._inited = true
            this.onInit()
        }
    }
    on(event: TEvent, callback: (...params: TParams[TEvent]["params"]) => TParams[TEvent]["return"], target: any, once = false) {
        if (!this._eventMap.has(event)) {
            this._eventMap.set(event, [])
        }
        var list = this._eventMap.get(event)
        if (list.find(info => info.target == target && info.callback == callback)) {
            return
        }
        list.push({ callback, target, once })
    }
    off(event: TEvent, callback: any, target: any) {
        if (!this._eventMap.has(event)) {
            return
        }
        var list = this._eventMap.get(event)
        var index = list.findIndex(info => info.callback == callback && info.target == target)
        if (index == -1) return
        list.splice(index, 1)
    }
    emit<M extends TEvent, N extends keyof TParams[M]>(event: M, ...params: TParams[M]["params"]): void {
        if (!this._eventMap.has(event)) {
            return
        }
        var list = this._eventMap.get(event)
        for (let i = 0; i < list.length; i++) {
            const info = list[i];
            info.callback.call(info.target, ...params)
            if (info.once) {
                list.splice(i, 1)
                i--
            }
        }
    }
    async request<M extends TEvent, N extends keyof TParams[M]>(event: TEvent, ...params: TParams[M]["params"]): Promise<TParams[TEvent]["return"]> {
        if (!this._eventMap.has(event)) {
            return
        }
        var list = this._eventMap.get(event)
        for (let i = 0; i < list.length; i++) {
            const info = list[i];
            const result = await info.callback.call(info.target, ...params)
            if (info.once) {
                list.splice(i, 1)
                i--
            }
            if (result) {
                return result
            }
        }
    }

}

