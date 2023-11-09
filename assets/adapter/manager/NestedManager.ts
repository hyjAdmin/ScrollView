const { ccclass, property } = cc._decorator;
import { Manager } from '../abstract/Manager';
import { Orientation } from '../enum/enum';
import { IVec2Like } from '../interface/interface';
import { ScrollAdapter } from '../ScrollAdapter';
import { ScrollManager } from './ScrollManager';
@ccclass("NestedManager")
export class NestedManager extends Manager {
    @property("boolean") enable: boolean = false
    private _parentAdapter: ScrollAdapter
    private _propagationStopped = true
    private _scrollStartPosition: IVec2Like
    private _processed = false
    private _direction = null
    protected onInit(): void {
        if (this.enable) {
            this._parentAdapter = this.getParentAdapter(this.adapter.node.parent)
            if (this._parentAdapter) {
                this.adapter.scrollManager.on(ScrollManager.Event.ON_SCROLL_START, this.onScrollStart, this)
                this.adapter.scrollManager.on(ScrollManager.Event.ON_SCROLL_MOVE, this.onScrollMove, this)
                this.adapter.scrollManager.on(ScrollManager.Event.ON_SCROLL_WHEEL, this.onScrollWheel, this)
            }
        }
    }
    private initPosition() {
        var position = this.adapter.scrollManager.content.position
        this._scrollStartPosition = { x: position.x, y: position.y }
        this._direction = null
        this._processed = false
    }
    private setPropagationStopped(stop: boolean) {
        this._propagationStopped = stop
        this.adapter.scrollManager["_stopMove"] = !stop
    }
    private checkDifferentDirection(event: cc.Event.EventTouch | cc.Event.EventMouse, position: IVec2Like) {
        if (this._direction == null) {
            var xOffset = 0, yOffset = 0
            if (event instanceof cc.Event.EventTouch) {
                var start = event.touch.getStartLocation()
                var curre = event.getLocation()
                xOffset = Math.abs(start.x - curre.x)
                yOffset = Math.abs(start.y - curre.y)

            } else {
                xOffset = Math.abs(event.getScrollX())
                yOffset = Math.abs(event.getScrollY())
            }
            if (xOffset > yOffset) {
                this._direction = Orientation.Horizontal
            } else if (yOffset > xOffset) {
                this._direction = Orientation.Vertical
            }
            if (this._direction != null) {
                if (this._direction == this.adapter.scrollManager.orientation) {
                    this.setPropagationStopped(true)
                } else {
                    this.setPropagationStopped(false)
                }
            }
        }
    }
    private checkSameDirection(position: IVec2Like) {
        if (this._processed) {
            return
        }
        var startPosition = this._scrollStartPosition[this.adapter.mainAxis.xy]
        var currPosition = position[this.adapter.mainAxis.xy]
        var direction = currPosition - startPosition
        if (Math.abs(direction) < 0.5) return
        if (direction > 0) {
            if (Math.floor(startPosition) >= this.adapter.scrollManager.hiddenSize) {
                this.setPropagationStopped(false)
            } else {
                this.setPropagationStopped(true)
            }
        } else {
            if (startPosition <= 0) {
                this.setPropagationStopped(false)
            } else {
                this.setPropagationStopped(true)
            }
        }
        this._processed = true
    }
    private onScrollStart(event: cc.Event.EventTouch) {
        this.initPosition()
    }
    private checkDirection(event: cc.Event.EventTouch | cc.Event.EventMouse, position: IVec2Like) {
        if (this.adapter.scrollManager.orientation == this._parentAdapter.scrollManager.orientation) {
            this.checkSameDirection(position)
        } else {
            this.checkDifferentDirection(event, position)
        }
    }
    private onScrollWheel(event: cc.Event.EventMouse, position: IVec2Like) {
        this.initPosition()
        this.checkDirection(event, position)
        event["_propagationStopped"] = this._propagationStopped
    }
    private onScrollMove(event: cc.Event.EventTouch, position: IVec2Like) {
        this.checkDirection(event, position)
        event["_propagationStopped"] = this._propagationStopped
    }
    private getParentAdapter(node: cc.Node) {
        if (node == null || (node instanceof cc.Scene)) return
        var adapter = node.getComponent("ScrollAdapter")
        if (adapter) {
            return adapter
        }
        return this.getParentAdapter(node.parent)
    }

}