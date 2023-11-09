import { ScrollAdapter } from '../../adapter/ScrollAdapter';
const { ccclass, property } = cc._decorator;
@ccclass
export class commonPanel extends cc.Component {
    @property(ScrollAdapter) adapter: ScrollAdapter = null;
    @property(cc.EditBox) scrollToEditBox: cc.EditBox = null;
    @property(cc.Slider) scrollDuration: cc.Slider = null;
    @property(cc.Label) scrollDurationLabel: cc.Label = null;
    @property(cc.Node) panel: cc.Node = null;
    @property(cc.Node) expand: cc.Node = null;
    @property(cc.Node) expandIcon: cc.Node = null;
    @property(cc.Toggle) loopHeaderToggle: cc.Toggle = null;
    @property(cc.Toggle) loopFooterToggle: cc.Toggle = null;
    private _isExpand = false;
    private _expandPosition: cc.Vec2;
    private _hiddenPosition: cc.Vec2;
    private _expandTween: cc.Tween;
    private _hiddenTween: cc.Tween;
    private _buttonExpandTween: cc.Tween;
    private _buttonHiddenTween: cc.Tween;
    private _expandIconExpandTween: cc.Tween;
    private _expandIconHiddenTween: cc.Tween;
    get duration() {
        var duration = Number(this.scrollDuration.progress);
        return isNaN(duration) ? 1 : duration;
    }
    start() {
        this.scheduleOnce(() => {
            this._expandPosition = this.panel.getPosition();
            this._hiddenPosition = this.panel.getPosition();
            this._hiddenPosition.x = this._expandPosition.x - this.panel.width - 20;
            this._expandTween = new cc.Tween(this.panel).to(
                0.5,
                {
                    position: this._expandPosition,
                },
                { easing: 'quintOut' }
            );
            this._hiddenTween = new cc.Tween(this.panel).to(
                0.5,
                {
                    position: this._hiddenPosition,
                },
                { easing: 'quintOut' }
            );
            this._buttonExpandTween = new cc.Tween(this.expand).to(
                0.5,
                {
                    width: 70,
                    height: 200,
                },
                { easing: 'quintOut' }
            );
            this._buttonHiddenTween = new cc.Tween(this.expand).to(
                0.5,
                {
                    width: 70,
                    height: 400,
                },
                { easing: 'quintOut' }
            );
            this._expandIconExpandTween = new cc.Tween(this.expandIcon).to(
                0.5,
                {
                    scaleX: 1,
                },
                { easing: 'quintOut' }
            );
            this._expandIconHiddenTween = new cc.Tween(this.expandIcon).to(
                0.5,
                {
                    scaleX: -1,
                },
                { easing: 'quintOut' }
            );
            this.onExpand();
            this.loopHeaderToggle.isChecked = this.adapter.viewManager.loopHeader;
            this.loopFooterToggle.isChecked = this.adapter.viewManager.loopFooter;
            this.scrollDuration.progress = 0.62;
            this.scrollDurationLabel.string = `Scroll Duration: ${this.scrollDuration.progress.toFixed(2)}`;
        });
    }

    onBack() {
        cc.director.loadScene('main');
    }
    onExpand() {
        if (this._isExpand) {
            this._expandTween.stop();
            this._hiddenTween.start();
            this._buttonExpandTween.stop();
            this._buttonHiddenTween.start();
            this._expandIconExpandTween.stop();
            this._expandIconHiddenTween.start();
        } else {
            this._expandTween.start();
            this._hiddenTween.stop();
            this._buttonExpandTween.start();
            this._buttonHiddenTween.stop();
            this._expandIconExpandTween.start();
            this._expandIconHiddenTween.stop();
        }
        this._isExpand = !this._isExpand;
    }
    onScrollTo() {
        var index = Number(this.scrollToEditBox.string);
        if (isNaN(index)) return;
        // this.adapter.scrollManager.scrollToModelIndex(this.duration, index, false, true)
        this.adapter.scrollManager.scrollToViewIndex(this.duration, index);
    }
    onScrollToHeader() {
        this.adapter.scrollManager.scrollToHeader(this.duration, true);
    }
    onScrollToFooter() {
        this.adapter.scrollManager.scrollToFooter(this.duration, true);
    }
    onToggleLoopHeader(toggle: cc.Toggle) {
        this.adapter.viewManager.loopHeader = toggle.isChecked;
    }
    onToggleLoopFooter(toggle: cc.Toggle) {
        this.adapter.viewManager.loopFooter = toggle.isChecked;
    }
    onSliderDuration(slider: cc.Slider) {
        this.scrollDurationLabel.string = `Scroll Duration: ${slider.progress.toFixed(2)}`;
    }
}
