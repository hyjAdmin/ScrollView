const { ccclass, property } = cc._decorator;
import { IParams, Manager } from '../abstract/Manager';
import { Layer, MovementType, Orientation, ScrollDirection } from '../enum/enum';
import { Mathf } from '../helper/Mathf';
import { IVec2Like } from '../interface/interface';
import { ViewManager } from './ViewManager';
const IS_DEBUG = false
enum Event {
    /** 滚动开始 */
    ON_SCROLL_START,
    /** 滚动中 触摸滚动 */
    ON_SCROLL_MOVE,
    /** 滚动结束 */
    ON_SCROLL_END,
    /** 取消滚动 */
    ON_SCROLL_CANCEL,
    /** 滚轮 */
    ON_SCROLL_WHEEL,
    /** 滚动中，触摸滚动或者自动滚动都会触发 */
    ON_SCROLL,
    /** 滚动即将停止 */
    ON_ABOUT_TO_STOP,
    /** 更新滚动进度 */
    ON_UPDATE_SCROLLBAR,
    /** 滚动到viewIndex索引位置时 */
    ON_SCROLL_TO_VIEWINDEX,
    /** 滚动到用户数据索引位置时 */
    ON_SCROLL_TO_MODELINDEX,
    /** content坐标被重置 */
    ON_RESET_CONTENT,
    /** 主轴方向改变 */
    ON_ORIENTATION_CHANGED,
    /** view尺寸改变 */
    ON_VIEW_SIZE_CHANGED,
}
interface ScrollEvent {
    params: [event: cc.Event.EventTouch]
    return: void
}
interface Params extends IParams {
    [Event.ON_SCROLL_START]: ScrollEvent
    [Event.ON_SCROLL_END]: ScrollEvent
    [Event.ON_SCROLL_CANCEL]: ScrollEvent
    [Event.ON_SCROLL_MOVE]: {
        params: [event: cc.Event.EventTouch, position: IVec2Like]
        return: void
    }
    [Event.ON_SCROLL_WHEEL]: {
        params: [event: cc.Event.EventMouse, position: IVec2Like]
        return: void
    }
    [Event.ON_UPDATE_SCROLLBAR]: {
        params: [offset: number, position: number, percentage: number],
        return: void
    }
}
@ccclass("ScrollManager")
export class ScrollManager extends Manager<Event, Params> {
    static Event = Event
    @property(cc.Node) view: cc.Node = null
    @property(cc.Node) content: cc.Node = null
    @property({ type: cc.Enum(Orientation) }) private _orientation: Orientation = Orientation.Vertical
    @property({ type: cc.Enum(Orientation) }) get orientation() { return this._orientation }
    set orientation(value: Orientation) {
        if (value == this._orientation) return
        this._orientation = value
        this.emit(Event.ON_ORIENTATION_CHANGED)
    }
    @property({
        type: cc.Enum(MovementType)
    }) movementType: MovementType = MovementType.Elastic
    @property({
        visible: function () { return this.movementType == MovementType.Elastic }
    }) elasticity: number = 0.1
    @property() inertia: boolean = true
    @property({
        range: [0, 1],
        slide: true,
        step: 0.001,
        visible: function () { return this.inertia }
    }) decelerationRate: number = 0.135
    @property() scrollSensitivity: number = 0.01
    @property() aboutToStopVelocity: number = 150
    private _virtualContent: cc.Node
    private _isTouch: boolean
    private _velocity = 0
    private _scrolling = false
    private _dragging = false
    private _prevPosition = new cc.Vec2()
    private _contentStartPosition = new cc.Vec2()
    private _scrollDirection = ScrollDirection.None
    private _percentage = 0
    private _isAutoScroll = false
    private _autoScrollParams: any
    private _isEmitAboutToStop = false
    private _isInitScrollbar = false
    private _boundaryOffset = 0
    private _canTouch = false
    private _stopMove = false
    private _isScrolling = false
    private _maxExpand: number = 0
    private _minExpand: number = 0
    private _layerLowest: cc.Node
    private _layerMedium: cc.Node
    private _layerHighest: cc.Node
    get maxExpand() { return this._maxExpand }
    get minExpand() { return this._minExpand }
    get isTouch() { return this._isTouch }
    get velocity() { return this._velocity }
    get boundaryOffset() { return this._boundaryOffset }
    get percentage() { return this._percentage }
    get isScrolling() { return this._isScrolling }
    private get _xy() { return this.adapter.mainAxis.xy }
    private get _wh() { return this.adapter.mainAxis.wh }
    private get _contentMin() { return this.adapter.multiplier == 1 ? -this.content[this._wh] : 0 }
    private get _contentMax() { return this.adapter.multiplier == 1 ? 0 : this.content[this._wh] }
    private get _viewMin() { return -this.view[this._wh] }
    private get _viewMax() { return this.view[this._wh] }
    get hiddenSize() {
        if (this.content[this._wh] <= this.view[this._wh]) {
            return this.view[this._wh] + this.adapter.mainAxisPadding
        }
        return this.content[this._wh] - this.view[this._wh] + this.adapter.mainAxisPadding
    }
    get scrollDirection() { return this._scrollDirection }
    get mainContentPosition() { return this.content.position[this._xy] }
    get mainVirtualContentPosition() { return this._virtualContent ? this._virtualContent.position[this._xy] : 0 }

    /**
     * 获取层级Node
     * @param layer 
     */
    getLayerNode(layer: Layer) {
        switch (layer) {
            case Layer.Medium:
                return this._layerMedium
            case Layer.Highest:
                return this._layerHighest
            default:
                return this._layerLowest
        }
    }
    /**
     * 滚动到头部
     * @param duration 持续时间
     * @param alwaysScrollToHeader 强制向头部滚动
     */
    scrollToHeader(duration: number, alwaysScrollToHeader: boolean = false) {
        this.scrollToViewIndex(duration, 0, alwaysScrollToHeader)
    }
    /**
     * 滚动到尾部
     * @param duration 持续时间
     * @param alwaysScrollToFooter 强制向尾部滚动
     */
    scrollToFooter(duration: number, alwaysScrollToFooter: boolean = false) {
        this.scrollToViewIndex(duration, this.adapter.viewManager.viewLength - 1, false, alwaysScrollToFooter)
    }
    /**
     * 滚动到指定view索引位置
     * @param duration 持续时间
     * @param viewIndex view索引，非用户数据索引
     * @param alwaysScrollToHeader 强制向头部滚动
     * @param alwaysScrollToFooter 强制向尾部滚动
     * @returns 
     */
    scrollToViewIndex(duration: number, viewIndex: number, alwaysScrollToHeader: boolean = false, alwaysScrollToFooter: boolean = false) {
        if (!this._canTouch) return
        this._isAutoScroll = false
        var percentage = this.adapter.autoCenterManager.getPercentageByViewIndex(viewIndex, alwaysScrollToHeader, alwaysScrollToFooter)
        if (percentage == null) return
        this.emit(Event.ON_SCROLL_TO_VIEWINDEX, viewIndex)
        this.scrollToPercentage(duration, percentage, viewIndex, alwaysScrollToHeader, alwaysScrollToFooter, true)
    }
    /**
     * 滚动到指定数据索引位置
     * @param duration 持续时间
     * @param modelIndex 用户数据索引
     * @param alwaysScrollToHeader 强制向头部滚动
     * @param alwaysScrollToFooter 强制向尾部滚动
     * @returns 
     */
    scrollToModelIndex(duration: number, modelIndex: number, alwaysScrollToHeader: boolean = false, alwaysScrollToFooter: boolean = false) {
        if (!this._canTouch) return
        this._isAutoScroll = false
        var percentage = this.adapter.autoCenterManager.getPercentageByModelIndex(modelIndex, alwaysScrollToHeader, alwaysScrollToFooter)
        if (percentage == null) return
        this.emit(Event.ON_SCROLL_TO_MODELINDEX, modelIndex)
        var viewIndex = this.adapter.viewManager.findViewIndexByModelIndex(modelIndex)
        this.emit(Event.ON_SCROLL_TO_VIEWINDEX, viewIndex)
        this.scrollToPercentage(duration, percentage, modelIndex, alwaysScrollToHeader, alwaysScrollToFooter, false)
    }
    protected onInit(): void {
        if (!this.view) {
            throw Error("ScrollManager cannot find parameter view")
        }
        if (!this.content) {
            throw Error("ScrollManager cannot find parameter content")
        }
        var layout = this.content.getComponent("Layout")
        if (layout) {
            layout.destroy()
        }
        this.initViewWidget()
        this.restoreToOriginalState()
        this._layerLowest = new cc.Node("layerLowest")
        this._layerMedium = new cc.Node("layerMedium")
        this._layerHighest = new cc.Node("layerHighest")
        this.content.addChild(this._layerLowest)
        this.content.addChild(this._layerMedium)
        this.content.addChild(this._layerHighest)

        this.initViewAndContent()
        this.view.on(cc.Node.EventType.TOUCH_START, this.onTouchStart, this)
        this.view.on(cc.Node.EventType.TOUCH_MOVE, this.onTouchMove, this)
        this.view.on(cc.Node.EventType.TOUCH_END, this.onTouchEnd, this)
        this.view.on(cc.Node.EventType.MOUSE_WHEEL, this.onMouseWheel, this)
        this.view.on(cc.Node.EventType.TOUCH_CANCEL, this.onTouchCancel, this)
        this.view.on(cc.Node.EventType.SIZE_CHANGED, this.onViewSizeChanged, this)
        this.adapter.viewManager.on(ViewManager.Event.ON_VIRTUAL_SIZE_CHANGED, this.onViewVirtualSizeChanged, this)
        this.adapter.viewManager.on(ViewManager.Event.ON_RESET_VIEW, this.onArrangeAxisChanged, this)
    }
    private setContentSize(size: number) {
        if (size < this.view[this._wh]) {
            this.content[this._wh] = Math.max(this.view[this._wh], size + this.adapter.mainAxisPadding)
        } else {
            this.content[this._wh] = size
        }
        this._virtualContent[this._wh] = this.content[this._wh]
        if (this.adapter.pullReleaseManager.enable) {
            this._canTouch = true
        } else if (this.adapter.autoCenterManager.enable && this.adapter.viewManager.viewLength > 0) {
            this._canTouch = true
        } else {
            this._canTouch = this.content[this._wh] > this.view[this._wh]
        }
        if (this.content[this._wh] <= this.view[this._wh]) {
            this.resetContentPosition()
        }
        this.updateScrollbar(0)
    }
    private scrollToPercentage(duration: number, percentage: number, index: number, alwaysScrollToHeader: boolean, alwaysScrollToFooter: boolean, isViewIndex: boolean) {
        this._autoScrollParams = {
            deltaTime: 0,
            current: 0,
            duration: duration,
            from: this._percentage,
            to: percentage,
            index: index,
            isViewIndex: isViewIndex,
            alwaysScrollToHeader: alwaysScrollToHeader,
            alwaysScrollToFooter: alwaysScrollToFooter
        }
        if (!this.adapter.autoCenterManager.enable && Mathf.approximately(this._autoScrollParams.from, this._autoScrollParams.to)) {
            return
        }
        if (duration <= 0) {
            this.scrollToAny(percentage)
            return
        }
        this._isAutoScroll = true
    }
    private onViewSizeChanged() {
        this.emit(Event.ON_VIEW_SIZE_CHANGED)
    }
    private onArrangeAxisChanged() {
        this.restoreToOriginalState()
    }
    private restoreToOriginalState() {
        this._isTouch = false
        this._velocity = 0
        this._scrolling = false
        this._dragging = false
        this._prevPosition.set(cc.v2(0, 0))
        this._contentStartPosition.set(cc.v2(0, 0))
        this._scrollDirection = ScrollDirection.None
        this._percentage = 0
        this._isAutoScroll = false
        this._autoScrollParams = null
        this._isEmitAboutToStop = false
        this._isInitScrollbar = false
        this._boundaryOffset = 0
        this._canTouch = false
        this._stopMove = false
        this._isScrolling = false
        this._maxExpand = 0
        this._minExpand = 0
        this.initViewAndContent()
    }
    private resetContentPosition() {
        this._maxExpand = 0
        this._minExpand = 0
        var position = this.content.getPosition()
        var magneticOffset = this.adapter.viewManager.magneticOffset
        position[this._xy] = this.adapter.isHorizontal ? magneticOffset : -magneticOffset
        this.updateVirtualContentPosition(position[this._xy])
        this.updateContentPosition(position)
        this.updatePrevData()
        this.updateScrollbar(0)
        this._isScrolling = false
        this.emit(Event.ON_RESET_CONTENT)
    }
    private resetVirtualContentPosition() {
        var mainPosition = this.mainContentPosition + this.adapter.viewManager.offsetHeader
        this.updateVirtualContentPosition(mainPosition)
    }
    private initViewAndContent() {
        if (!this._virtualContent) {
            var virtualContent = cc.instantiate(this.content)
            virtualContent.name = "virtualContent"
            virtualContent.parent = this.content.parent
            virtualContent.setSiblingIndex(0)
            this._virtualContent = virtualContent
        }
        var point = { x: 0.5, y: 0.5 }
        point[this.adapter.mainAxis.xy] = Mathf.clamp01(this.adapter.multiplier)
        this.view.setAnchorPoint(point.x, point.y)
        this.content.setAnchorPoint(point.x, point.y)
        this._virtualContent.setAnchorPoint(point.x, point.y)

        this.setContentSize(0)
        this.content[this.adapter.crossAxis.wh] = this.view[this.adapter.crossAxis.wh]
        this._virtualContent[this.adapter.crossAxis.wh] = this.view[this.adapter.crossAxis.wh]
        this.content.setPosition(0, 0)
        this._virtualContent.setPosition(0, 0)
    }
    private initViewWidget() {
        var widget = this.view.getComponent(cc.Widget)
        if (!widget) {
            widget = this.view.addComponent(cc.Widget)
            widget.isAlignLeft = widget.isAlignRight = widget.isAlignTop = widget.isAlignBottom = true
            widget.left = widget.right = widget.top = widget.bottom = 0
        }
        widget.updateAlignment()
    }
    private onTouchStart(event: cc.Event.EventTouch) {
        this.emit(Event.ON_SCROLL_START, event)
        if (!this._canTouch) return
        this._isTouch = true
        this._velocity = 0
        this._dragging = true
        this._isEmitAboutToStop = false
        this._isAutoScroll = false
        this._isScrolling = false
        this._scrollDirection = ScrollDirection.None
        this._contentStartPosition.set(this.content.position)
    }
    private onMouseWheel(event: cc.Event.EventMouse) {
        if (!this._canTouch) return
        this._isTouch = true
        var delta = 0
        var x = event.getScrollX()
        var y = -event.getScrollY()
        if (this.adapter.isVertical) {
            if (Math.abs(x) > Math.abs(y)) {
                delta = x
            } else {
                delta = y
            }
        } else {
            if (Math.abs(y) > Math.abs(x)) {
                delta = y
            } else {
                delta = x
            }
        }
        this._scrolling = true
        var position = this.content.getPosition()
        position[this._xy] += delta * this.scrollSensitivity
        if (this.movementType == MovementType.Clamped) {
            position[this._xy] += this.calculateOffset(position[this._xy] - this.mainContentPosition)
        }
        this.emit(Event.ON_SCROLL_WHEEL, event, position)
        if (!this._stopMove) {
            this.updateContentPosition(position)
        }
    }
    private onTouchMove(event: cc.Event.EventTouch) {
        if (!this._canTouch) return
        this._isTouch = true
        var location = event.getLocation()[this._xy]
        var startLocation = event.getStartLocation()[this._xy]
        var pointerDelta = location - startLocation

        var position = { x: 0, y: 0 }
        position[this._xy] = this._contentStartPosition[this._xy] + pointerDelta
        var delta = position[this._xy] - this.content.position[this._xy]
        var offset = this.calculateOffset(delta)
        var axis = this.adapter.isHorizontal ? -1 : 1
        position[this._xy] += axis * offset
        if (this.movementType == MovementType.Elastic) {
            if (offset != 0) {
                position[this._xy] -= axis * this.rubberDelta(offset, this.view[this._wh])
            }
        }
        this.emit(Event.ON_SCROLL_MOVE, event, position)
        if (!this._stopMove && pointerDelta != 0) {
            this.updateContentPosition(position)
        }
    }
    private onTouchEnd(event: cc.Event.EventTouch) {
        if (!this._canTouch) return
        this._isTouch = true
        this._dragging = false
        this.emit(Event.ON_SCROLL_END, event)
    }
    private onTouchCancel(event: cc.Event.EventTouch) {
        if (!this._canTouch) return
        this._isTouch = true
        this._dragging = false
        this.emit(Event.ON_SCROLL_CANCEL, event)
    }
    private lateUpdate(deltaTime: number) {
        if (!this.adapter.viewManager.magnetic) {
            if (!this._canTouch) return
        }
        this.autoScroll(deltaTime)
        var offset = this.calculateOffset(0)
        this._boundaryOffset = offset
        if (!this._dragging && (offset != 0 || this._velocity != 0)) {
            this.emitAboutToStop()
            var position = this.content.getPosition()
            if (this.movementType == MovementType.Elastic && offset != 0) {
                this.calculateElastic(deltaTime, offset, position)
            } else if (this.inertia) {
                this.calculateInertia(deltaTime, position)
            } else {
                this._velocity = 0
            }
            if (this.movementType == MovementType.Clamped) {
                this.calculateClamped(position)
            }
            this.updateContentPosition(position)
        }
        if (this._dragging && this.inertia) {
            var newVelocity = (this.content.position[this._xy] - this._prevPosition[this._xy]) / deltaTime
            this._velocity = Mathf.lerp(this._velocity, newVelocity, deltaTime * 10)
        }
        if (!this._isInitScrollbar || !this._prevPosition.equals(this.content.position)) {
            this._isInitScrollbar = true
            this.updateScrollbar(offset)
            this.updatePrevData()
        } else {
            this._isScrolling = false
        }
        this.emitAboutToStop()
        this._scrolling = false
    }
    private emitAboutToStop() {
        if (!this._isAutoScroll && !this._dragging && !this._isEmitAboutToStop && Math.abs(this._velocity) <= this.aboutToStopVelocity) {
            this.emit(Event.ON_ABOUT_TO_STOP, this._velocity)
            this._isEmitAboutToStop = true
        }
    }
    private onViewVirtualSizeChanged() {
        if (!this._autoScrollParams) return
        var getPercentageFunction = this._autoScrollParams.isViewIndex
            ? this.adapter.autoCenterManager.getPercentageByViewIndex.bind(this.adapter.autoCenterManager)
            : this.adapter.autoCenterManager.getPercentageByModelIndex.bind(this.adapter.autoCenterManager)
        var percentage = getPercentageFunction(
            this._autoScrollParams.index,
            this._autoScrollParams.alwaysScrollToHeader,
            this._autoScrollParams.alwaysScrollToFooter,
        )
        if (percentage == null) return
        if (this._autoScrollParams.duration <= 0) {
            this.scrollToAny(percentage)
        } else {
            this._autoScrollParams.from = this.percentage
            this._autoScrollParams.to = percentage
        }
    }
    private autoScroll(deltaTime: number) {
        if (!this._isAutoScroll) return
        this._autoScrollParams.deltaTime += deltaTime
        let time = this._autoScrollParams.deltaTime / (this._autoScrollParams.duration > cc.macro.FLT_EPSILON /**0.0000001192092896 */ ? this._autoScrollParams.duration : cc.macro.FLT_EPSILON)
        time = Mathf.clamp01(time)
        var easingTime = cc.easing.quintOut(time)
        this._autoScrollParams.current = this.progress(this._autoScrollParams.from, this._autoScrollParams.to, this._autoScrollParams.current, easingTime);
        this.scrollToAny(this._autoScrollParams.current)
        if (time == 1) {
            this.stopAutoScroll()
        }
    }
    private stopAutoScroll() {
        if (!this._autoScrollParams) return
        var oldTo = this._autoScrollParams.to
        this.scrollToAny(oldTo)
        if (this._autoScrollParams && oldTo != this._autoScrollParams.to) {
            this.scrollToAny(this._autoScrollParams.to)
        }
        this._isAutoScroll = false
        this._autoScrollParams = null
    }
    private scrollToAny(percentage: number) {
        var position = {
            x: this.content.position.x,
            y: this.content.position.y
        }
        var newContentPosition = this.getPositionByPercentage(percentage)
        if (Math.abs(position[this._xy] - newContentPosition) > 0.01) {
            this._velocity = 0
            position[this._xy] = newContentPosition
            this.updateContentPosition(position)
            this.updateScrollbar(0)
            this.updatePrevData()
        } else {
            this._isAutoScroll = false
            this._autoScrollParams = null
            this.updateScrollbar(0)
        }
    }
    private getPositionByPercentage(percentage: number) {
        var padding = this.adapter.mainAxisPadding
        var contentMin = this._contentMin * this.adapter.multiplier
        var axis = this.adapter.multiplier * padding
        var curContentPosition = contentMin - axis - this.hiddenSize * percentage
        var newContentPosition = contentMin - padding - curContentPosition * this.adapter.multiplier
        return newContentPosition
    }
    private calculateElastic(deltaTime: number, offset: number, out: cc.Vec2) {
        var smoothTime = this.elasticity
        if (this._scrolling) {
            smoothTime *= 3
        }
        var axis = this.adapter.isHorizontal ? -1 : 1
        var { velocity, position } = Mathf.smoothDamp(
            this.content.position[this._xy],
            this.content.position[this._xy] + axis * offset,
            this._velocity,
            smoothTime,
            Mathf.Infinity,
            deltaTime
        )
        if (Math.abs(velocity) < 1) {
            velocity = 0
        }
        this._velocity = velocity
        out[this._xy] = position
    }
    private calculateInertia(deltaTime: number, out: cc.Vec2) {
        this._velocity *= Math.pow(this.decelerationRate, deltaTime)
        if (Math.abs(this._velocity) < 1) {
            this._velocity = 0
        }
        out[this._xy] += this._velocity * deltaTime
    }
    private calculateClamped(out: cc.Vec2) {
        var boundary = out[this._xy] - this.content.position[this._xy]
        var offset = this.calculateOffset(boundary)
        if (this.adapter.isHorizontal) {
            out[this._xy] -= offset
        } else {
            out[this._xy] += offset
        }
    }
    private updateContentPosition(position: IVec2Like) {
        this._isScrolling = true
        this.updateScrollOrientation(position)
        var rawPosition = this.content.getPosition()
        this.content.setPosition(position.x, position.y)
        var mainPosition = this.mainVirtualContentPosition + (position[this._xy] - rawPosition[this._xy])
        this.updateVirtualContentPosition(mainPosition)
        this.emit(Event.ON_SCROLL)
    }
    private updateVirtualContentPosition(mainPosition: number) {
        var virtualPosition = this._virtualContent.getPosition()
        virtualPosition[this._xy] = mainPosition
        this._virtualContent.setPosition(virtualPosition)
    }
    private updateScrollOrientation(position: IVec2Like) {
        var delta = position[this._xy] - this.content.position[this._xy]
        if (delta == 0) {
            this._scrollDirection = ScrollDirection.None
            return
        }
        if (this.adapter.isHorizontal) {
            this._scrollDirection = delta > 0 ? ScrollDirection.Right : ScrollDirection.Left
        } else {
            this._scrollDirection = delta > 0 ? ScrollDirection.Up : ScrollDirection.Down
        }
    }
    private updateScrollbar(offset: number) {
        var hiddenSize = this.hiddenSize
        var position = this.mainContentPosition * this.adapter.multiplier
        if (!this.adapter.autoCenterManager.enable) {
            position += this.adapter.viewManager.magneticOffset
        }
        this._percentage = position / hiddenSize
        if (isNaN(this._percentage)) {
            this._percentage = 0
        }
        this.claculateVirtualContent()
        var position = this.mainVirtualContentPosition * this.adapter.multiplier
        var value = position / hiddenSize
        if (this.adapter.viewManager.loopFooter && this.adapter.viewManager.loopHeader) {
        } else if (this.adapter.viewManager.loopFooter) {
            value = this.calculateValueLoopFooter(position, offset)
        } else if (this.adapter.viewManager.loopHeader) {
            value = this.calculateValueLoopHeader(position, offset)
        }
        this.emit(Event.ON_UPDATE_SCROLLBAR, offset, position, value)
    }
    private claculateVirtualContent() {
        if (this.adapter.viewManager.header && this.adapter.viewManager.header.viewIndex == 0) {
            this.updateVirtualContentPosition(this.adapter.viewManager.header.headerBoundary)
        } else if (this.adapter.viewManager.footer && this.adapter.viewManager.footer.viewIndex == this.adapter.viewManager.viewLength - 1) {
            var mainPosition = this.adapter.viewManager.footer.footerBoundary + this.adapter.viewManager.virtualSize * this.adapter.multiplier
            this.updateVirtualContentPosition(mainPosition)
        }
    }
    private calculateValueLoopHeader(position: number, offset: number) {
        if (!this.adapter.viewManager.footer) return
        var hiddenSize = this.adapter.viewManager.virtualSize
        position = this.mainVirtualContentPosition + this.adapter.viewMainSize * this.adapter.multiplier
        position = Math.abs(position)
        return position / hiddenSize
    }
    private calculateValueLoopFooter(position: number, offset: number) {
        if (!this.adapter.viewManager.header) return
        var hiddenSize = this.adapter.viewManager.virtualSize
        position = Math.abs(this.mainVirtualContentPosition)
        position -= this.adapter.multiplier * offset
        return position / hiddenSize
    }
    private updatePrevData() {
        this._prevPosition.set(this.content.position)
    }
    private rubberDelta(overStretching: number, viewSize: number): number {
        return (1 - (1 / ((Math.abs(overStretching) * 0.55 / viewSize) + 1))) * viewSize * Math.sign(overStretching)
    }
    private getMaxBoundaryOffset(max: number) {
        var viewMax = this._viewMax
        if (this.adapter.isHorizontal) {
            return this.adapter.isArrangeStart ? max : viewMax + max
        } else {
            return this.adapter.isArrangeStart ? -max : viewMax - max
        }
    }
    private getMinBoundaryOffset(min: number) {
        var viewMin = this._viewMin
        if (this.adapter.isHorizontal) {
            return this.adapter.isArrangeStart ? viewMin + min : min
        } else {
            return this.adapter.isArrangeStart ? viewMin - min : -min
        }
    }
    private getContentMaxBoundaryOffset(delta: number) {
        if (this.adapter.viewManager.viewLength == 0 || !this.adapter.autoCenterManager.enable && this.adapter.viewManager.virtualSize <= this.view[this._wh]) {
            if (this.adapter.isHorizontal) {
                return this.content.position[this._xy] + this._contentMin + delta
            } else {
                return this.content.position[this._xy] + this._contentMax + delta
            }
        }
        return this.adapter.viewManager.max + delta
    }
    private getContentMinBoundaryOffset(delta: number) {
        if (this.adapter.viewManager.viewLength == 0 || !this.adapter.autoCenterManager.enable && this.adapter.viewManager.virtualSize <= this.view[this._wh]) {
            if (this.adapter.isHorizontal) {
                return this.content.position[this._xy] + this._contentMax + delta
            } else {
                return this.content.position[this._xy] + this._contentMin + delta
            }
        }
        return this.adapter.viewManager.min + delta
    }
    private calculateOffset(delta: number): number {
        var offset = 0
        if (this.movementType == MovementType.Unrestricted) {
            return offset
        }
        var max = this.getContentMaxBoundaryOffset(delta)
        var min = this.getContentMinBoundaryOffset(delta)
        var maxOffset = this.getMaxBoundaryOffset(max)
        var minOffset = this.getMinBoundaryOffset(min)
        // TODO 继续增加偏移量
        var maxExpand = 0, minExpand = 0
        if (!this.adapter.autoCenterManager.enable && this.adapter.viewManager.virtualSize > this.view[this._wh]) {
            if (this.adapter.isVertical) {
                maxExpand = this.adapter.viewManager.top
                minExpand = this.adapter.viewManager.bottom
            } else {
                maxExpand = this.adapter.viewManager.left
                minExpand = this.adapter.viewManager.right
            }
            maxOffset -= maxExpand
            minOffset += minExpand
            maxExpand = 0
            minExpand = 0
        }

        if (this.adapter.autoCenterManager.enable && this.adapter.viewManager.viewLength > 0) {
            maxExpand = this.adapter.autoCenterManager.max
            minExpand = this.adapter.autoCenterManager.min
        } else {
            var magneticOffset = this.adapter.viewManager.magneticOffset
            maxOffset -= magneticOffset
            minOffset -= magneticOffset
        }
        this._maxExpand = 0
        this._minExpand = 0
        if (this.adapter.pullReleaseManager.enable) {
            maxExpand = Math.max(maxExpand, this.adapter.pullReleaseManager.max)
            minExpand = Math.max(minExpand, this.adapter.pullReleaseManager.min)
            this._maxExpand = this.adapter.pullReleaseManager.max
            this._minExpand = this.adapter.pullReleaseManager.min
        }
        maxOffset -= maxExpand
        minOffset += minExpand
        if (minOffset < -0.001) {
            offset = minOffset
        } else if (maxOffset > 0.001) {
            offset = maxOffset
        }
        return offset
    }
    private progress(start: number, end: number, current: number, t: number) {
        return current = start + (end - start) * t
    }
    private setTouch(value: boolean) {
        this._isTouch = value
    }
}

