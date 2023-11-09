const { ccclass, property } = cc._decorator;
import { IParams, Manager } from '../abstract/Manager';
import { ScrollManager } from './ScrollManager';
enum Event {
    ON_PULL_UP,
    ON_PULL_DOWN,
    ON_PULL_LEFT,
    ON_PULL_RIGHT,
}
interface ParamsType {
    params: [event: PullRelease]
    return: void
}
interface Params extends IParams {
    [Event.ON_PULL_UP]: ParamsType
    [Event.ON_PULL_DOWN]: ParamsType
    [Event.ON_PULL_LEFT]: ParamsType
    [Event.ON_PULL_RIGHT]: ParamsType
}
export enum PullReleaseState {
    IDLE,
    PULL,
    WAIT,
    RELEASE,
}
/** 事件参数 */
export class PullRelease {
    private _expand: number = 0
    get expand() { return this._expand }
    private _progress: number = 0
    private _offset: number = 0
    private _state: PullReleaseState
    get progress() { return this._progress }
    get offset() { return this._offset }
    get state() { return this._state }
    private _defaultPercentage: number
    private _manager: PullReleaseManager
    private _event: Event
    private _stop: boolean
    constructor(manager: PullReleaseManager, event: Event, defaultPercentage: number) {
        this._defaultPercentage = defaultPercentage
        this._manager = manager
        this._event = event
    }
    private set(offset: number, isContinue: boolean) {
        if (isContinue) {
            this._stop = false
        }
        if (this._stop) return
        this._offset = offset
        this._progress = offset / (this._defaultPercentage * this._manager.adapter.viewMainSize)
        this._stop = this._offset <= 0.1
        this.setState(PullReleaseState.PULL)
        this._manager.emit(this._event, this)
    }
    private setState(value: PullReleaseState) {
        if (this._state == PullReleaseState.WAIT) {
            return
        }
        if (value == PullReleaseState.PULL && this._state == PullReleaseState.RELEASE) {
            return
        }
        this._state = value
    }
    /**
     * 等待
     * @param expandSize 扩展尺寸
     */
    wait(expandSize: number = this._defaultPercentage * this._manager.adapter.viewMainSize) {
        this._expand = expandSize
        this._state = PullReleaseState.WAIT
    }
    /**
     * 释放
     */
    release() {
        this._expand = 0
        this._state = PullReleaseState.IDLE
        if (this.offset <= 0.1) {
            this._offset = 0
            this._progress = 0
            this._manager.emit(this._event, this)
        }
    }
}

@ccclass("PullReleaseManager")
export class PullReleaseManager extends Manager<Event, Params> {
    static Event = Event
    @property() enable: boolean = false
    @property({
        range: [0, 1],
        slide: true,
        step: 0.01,
        visible: function () { return this.enable }
    }) upOffsetPercentage: number = 0
    @property({
        range: [0, 1],
        slide: true,
        step: 0.01,
        visible: function () { return this.enable }
    }) downOffsetPercentage: number = 0
    @property({
        range: [0, 1],
        slide: true,
        step: 0.01,
        visible: function () { return this.enable }
    }) leftOffsetPercentage: number = 0
    @property({
        range: [0, 1],
        slide: true,
        step: 0.01,
        visible: function () { return this.enable }
    }) rightOffsetPercentage: number = 0
    private _pullUp: PullRelease
    private _pullDown: PullRelease
    private _pullLeft: PullRelease
    private _pullRight: PullRelease
    get max() {
        if (!this.enable) return 0
        if (this.adapter.isHorizontal) {
            return this._pullLeft.expand
        } else {
            return this._pullDown.expand
        }
    }
    get min() {
        if (!this.enable) return 0
        if (this.adapter.isHorizontal) {
            return this._pullRight.expand
        } else {
            return this._pullUp.expand
        }
    }

    protected onInit(): void {
        if (!this.enable) return
        this._pullUp = new PullRelease(this, Event.ON_PULL_UP, this.downOffsetPercentage)
        this._pullDown = new PullRelease(this, Event.ON_PULL_DOWN, this.upOffsetPercentage)
        this._pullLeft = new PullRelease(this, Event.ON_PULL_LEFT, this.rightOffsetPercentage)
        this._pullRight = new PullRelease(this, Event.ON_PULL_RIGHT, this.leftOffsetPercentage)
        this.adapter.scrollManager.on(ScrollManager.Event.ON_SCROLL_START, this.onScrollStart, this)
        this.adapter.scrollManager.on(ScrollManager.Event.ON_SCROLL_END, this.onScrollEnd, this)
        this.adapter.scrollManager.on(ScrollManager.Event.ON_SCROLL_CANCEL, this.onScrollEnd, this)
        this.checkLoop()
    }
    private checkLoop() {
        if (this.adapter.isHorizontal) {
            if (this.adapter.isArrangeStart) {
                if (this.leftOffsetPercentage > 0) {
                    this.adapter.viewManager.loopHeader = false
                }
                if (this.rightOffsetPercentage > 0) {
                    this.adapter.viewManager.loopFooter = false
                }
            } else {
                if (this.leftOffsetPercentage > 0) {
                    this.adapter.viewManager.loopFooter = false
                }
                if (this.rightOffsetPercentage > 0) {
                    this.adapter.viewManager.loopHeader = false
                }
            }
        } else {
            if (this.adapter.isArrangeStart) {
                if (this.upOffsetPercentage > 0) {
                    this.adapter.viewManager.loopHeader = false
                }
                if (this.downOffsetPercentage > 0) {
                    this.adapter.viewManager.loopFooter = false
                }
            } else {
                if (this.upOffsetPercentage > 0) {
                    this.adapter.viewManager.loopFooter = false
                }
                if (this.downOffsetPercentage > 0) {
                    this.adapter.viewManager.loopHeader = false
                }
            }
        }
    }
    private onScrollStart() {
        if (this.adapter.isHorizontal) {
            if (this.leftOffsetPercentage > 0) {
                this._pullRight["setState"](PullReleaseState.IDLE)
            }
            if (this.rightOffsetPercentage > 0) {
                this._pullLeft["setState"](PullReleaseState.IDLE)
            }
        } else {
            if (this.upOffsetPercentage > 0) {
                this._pullDown["setState"](PullReleaseState.IDLE)
            }
            if (this.downOffsetPercentage > 0) {
                this._pullUp["setState"](PullReleaseState.IDLE)
            }
        }
    }
    private onScrollEnd() {
        if (this.adapter.isHorizontal) {
            if (this.leftOffsetPercentage > 0) {
                this._pullRight["setState"](PullReleaseState.RELEASE)
            }
            if (this.rightOffsetPercentage > 0) {
                this._pullLeft["setState"](PullReleaseState.RELEASE)
            }
        } else {
            if (this.upOffsetPercentage > 0) {
                this._pullDown["setState"](PullReleaseState.RELEASE)
            }
            if (this.downOffsetPercentage > 0) {
                this._pullUp["setState"](PullReleaseState.RELEASE)
            }
        }
    }
    private lateUpdate(deltaTime: number) {
        if (!this.enable) return
        var offset = this.adapter.scrollManager.boundaryOffset
        if (!this.adapter.scrollManager.isTouch) {
            offset = 0
        }
        if (this.adapter.isHorizontal) {
            if (this.leftOffsetPercentage > 0) {
                this._pullRight["set"](Math.max(-offset, 0), offset < 0)
            }
            if (this.rightOffsetPercentage > 0) {
                this._pullLeft["set"](Math.max(offset, 0), offset > 0)
            }
        } else {
            if (this.upOffsetPercentage > 0) {
                this._pullDown["set"](Math.max(offset, 0), offset > 0)
            }
            if (this.downOffsetPercentage > 0) {
                this._pullUp["set"](Math.max(-offset, 0), offset < 0)
            }
        }
    }
}