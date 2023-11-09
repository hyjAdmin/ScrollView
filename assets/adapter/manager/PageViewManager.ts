const { ccclass, property } = cc._decorator;
import { Manager } from '../abstract/Manager';
import { ScrollManager } from './ScrollManager';
import { ViewManager } from './ViewManager';
enum Event {
    ON_PAGE_LENGTH_CHANGED,
    ON_SCROLL_PAGE_BEFOR,
    ON_SCROLL_PAGE_END,
}
@ccclass("PageViewManager")
export class PageViewManager extends Manager<Event> {
    static Event = Event
    @property() enable: boolean = false
    @property({
        range: [0, 1],
        slide: true,
        step: 0.01,
        visible: function () { return this.enable }
    }) scrollThreshold: number = 0.5
    @property({
        range: [0, 1],
        slide: true,
        step: 0.01,
        visible: function () { return this.enable }
    }) pageTurningEventTiming: number = 0.1

    @property({
        visible: function () { return this.enable }
    }) autoPageTurningThreshold: number = 100

    @property({
        visible: function () { return this.enable }
    }) pageTurningSpeed: number = 0.3

    private _currentIndex: number = 0
    get currentIndex() { return this._currentIndex }
    get length() { return this.adapter.viewManager.viewLength }
    protected onInit(): void {
        if (this.enable) {
            this.adapter.scrollManager.on(ScrollManager.Event.ON_SCROLL_END, this.handleReleaseLogic, this)
            this.adapter.scrollManager.on(ScrollManager.Event.ON_SCROLL_CANCEL, this.handleReleaseLogic, this)
            this.adapter.scrollManager.on(ScrollManager.Event.ON_SCROLL_TO_VIEWINDEX, this.onScrollToIndex, this)
            this.adapter.scrollManager.on(ScrollManager.Event.ON_RESET_CONTENT, this.onResetContent, this)
            this.adapter.viewManager.on(ViewManager.Event.ON_UPDATE_VIEWS, this.onUpdateViews, this, true)
        }
    }
    private onResetContent() {
        this._currentIndex = 0
    }
    private onUpdateViews() {
        this.emit(Event.ON_PAGE_LENGTH_CHANGED)
        this._currentIndex = 0
        this.scrollToPage(this.pageTurningSpeed, this._currentIndex)
    }
    private handleReleaseLogic(event: cc.Event.EventTouch) {
        if (!this.enable) return
        var start = event.getStartLocation()[this.adapter.mainAxis.xy]
        var end = event.getLocation()[this.adapter.mainAxis.xy]
        var offset = start - end
        var nextIndex = this.getNextIndex(offset)
        if (this.isScrollable(offset) || this.isQuicklyScrollable(this.adapter.scrollManager.velocity)) {
            this.scrollToPage(this.pageTurningSpeed, nextIndex)
            return
        }
        this.scrollToPage(this.pageTurningSpeed, this._currentIndex)
    }
    /**
     * 滚动到指定分页
     * @param duration 持续时间
     * @param viewIndex 分页索引
     * @param alwaysScrollToHeader 强制向头部滚动
     * @param alwaysScrollToFooter 强制向尾部滚动
     */
    scrollToPage(duration: number, index: number, alwaysScrollToHeader: boolean = false, alwaysScrollToFooter: boolean = false) {
        if (index < 0 || index >= this.adapter.viewManager.viewLength) {
            return
        }
        this.adapter.scrollManager.scrollToViewIndex(duration, index, alwaysScrollToHeader, alwaysScrollToFooter)
        this.emit(Event.ON_SCROLL_PAGE_BEFOR, index)
    }
    /**
     * 滚动到上一页
     * @param duration 持续时间
     * @param alwaysScrollToHeader 强制向头部滚动
     */
    scrollToPrevPage(duration: number, alwaysScrollToHeader: boolean = false) {
        if (this._currentIndex == 0) {
            if (this.adapter.viewManager.loopHeader) {
                this.scrollToPage(duration, this.adapter.viewManager.viewLength - 1, alwaysScrollToHeader)
            }
            return
        }
        this.scrollToPage(duration, this._currentIndex - 1, alwaysScrollToHeader)
    }
    /**
     * 滚动到下一页
     * @param duration 持续时间
     * @param alwaysScrollToFooter 强制向尾部滚动
     */
    scrollToNextPage(duration: number, alwaysScrollToFooter: boolean = false) {
        if (this._currentIndex >= this.adapter.viewManager.viewLength - 1) {
            if (this.adapter.viewManager.loopFooter) {
                this.scrollToPage(duration, 0, false, alwaysScrollToFooter)
            }
            return
        }
        this.scrollToPage(duration, this._currentIndex + 1, false, alwaysScrollToFooter)
    }

    private getNextIndex(offset: number) {
        var index = this._currentIndex
        if (this.adapter.isHorizontal) {
            if (this.adapter.isArrangeStart) {
                if (offset > 0) {
                    index++
                } else if (offset < 0) {
                    index--
                }
            } else {
                if (offset < 0) {
                    index++
                } if (offset > 0) {
                    index--
                }
            }

        } else {
            if (this.adapter.isArrangeStart) {
                if (offset < 0) {
                    index++
                } else if (offset > 0) {
                    index--
                }
            } else {
                if (offset > 0) {
                    index++
                } else if (offset < 0) {
                    index--
                }
            }
        }
        if (index >= this.adapter.viewManager.viewLength && this.adapter.viewManager.loopFooter) {
            index = 0
        } else if (index < 0 && this.adapter.viewManager.loopHeader) {
            index = this.adapter.viewManager.viewLength - 1
        }

        if (index < 0 || index >= this.adapter.viewManager.viewLength) {
            index = this._currentIndex
        }
        return index
    }
    private onScrollToIndex(index: number) {
        this._currentIndex = index
        this.emit(Event.ON_SCROLL_PAGE_END, index)
    }
    // 是否超过自动滚动临界值
    private isScrollable(offset: number) {
        return Math.abs(offset) >= this.adapter.viewMainSize * this.scrollThreshold
    }
    private isQuicklyScrollable(touchMoveVelocity: number) {
        return Math.abs(touchMoveVelocity) > this.autoPageTurningThreshold
    }

}