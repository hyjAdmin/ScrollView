const { ccclass, property } = cc._decorator;
import { Holder } from './abstract/Holder';
import { View } from './abstract/View';
import { ArrangeAxis, Orientation } from './enum/enum';
import { AutoCenterManager } from './manager/AutoCenterManager';
import { LayoutManager } from './manager/LayoutManager';
import { ModelManager } from './manager/ModelManager';
import { NestedManager } from './manager/NestedManager';
import { PageViewManager } from './manager/PageViewManager';
import { PullReleaseManager } from './manager/PullReleaseManager';
import { ScrollManager } from './manager/ScrollManager';
import { ViewManager } from './manager/ViewManager';
@ccclass
export abstract class ScrollAdapter<TModel = any> extends cc.Component {
    /**
     * 通过传入的data来决定返回一个 prefab
     * @param data 用户自定义数据
     */
    abstract getPrefab(data: TModel): cc.Node | cc.Prefab
    /**
     * 返回一个继承了View的子类对象
     */
    abstract getView(): View<TModel>
    /**
     * 返回一个继承了Holder的子类对象
     * @param node 绑定的node节点
     * @param code node特征码
     */
    abstract getHolder(node: cc.Node, code: string): Holder<TModel>
    /**
     * 滚动管理器 
     * 滚动的实现逻辑，类似cc.ScrollView
     */
    @property(ScrollManager) scrollManager: ScrollManager = new ScrollManager()
    /**
     * view管理器 
     * 这个类维护了prefab的创建、回收，等... 
     */
    @property(ViewManager) viewManager: ViewManager<TModel> = new ViewManager()
    /**
     * 布局管理器
     * 只布局交叉轴方向，主轴方向交给viewManager处理
     */
    @property(LayoutManager) layoutManager: LayoutManager = new LayoutManager()
    /**
     * 下拉释放管理器
     */
    @property(PullReleaseManager) pullReleaseManager: PullReleaseManager = new PullReleaseManager()
    /**
     * 自动居中管理器
     * 虽然叫自动居中，但这个类里的一些方法是个通用的
     * 比如：查找可视区域中心的索引，通过数据索引、view索引来计算滚动的具体百分比
     */
    @property(AutoCenterManager) autoCenterManager: AutoCenterManager = new AutoCenterManager()
    /**
     * 分页管理器
     * 分页逻辑在这里，类似cc.PageView
     */
    @property(PageViewManager) pageViewManager: PageViewManager = new PageViewManager()
    /**
     * 嵌套管理器
     * 处理同方向或反方向的触摸事件拦截
     */
    @property(NestedManager) nestedManager: NestedManager = new NestedManager()
    private _transform: cc.Node
    get transform() {
        if (!this._transform) {
            this._transform = this.node
        }
        return this._transform
    }
    /**
     * 数据管理器
     * 用户必须通过这个类来对数据 增删改查
     */
    private _modelManager: ModelManager<TModel> = new ModelManager()
    get modelManager() { return this._modelManager }
    /** 水平方向Padding总和 */
    get horizontal() { return this.viewManager.left + this.viewManager.right }
    /** 垂直方向Padding总和 */
    get vertical() { return this.viewManager.top + this.viewManager.bottom }
    /** 主轴方向是否是水平的 */
    get isHorizontal() { return this.scrollManager.orientation == Orientation.Horizontal }
    /** 主轴方向是否是垂直的 */
    get isVertical() { return this.scrollManager.orientation == Orientation.Vertical }
    /** 主轴方向排列轴 是否是：（水平方向时，是否是从左到右）（垂直方向时，是否是从上到下） */
    get isArrangeStart() { return this.viewManager.arrangeAxis == ArrangeAxis.Start }
    /** 主轴方向排列轴 是否是：（水平方向时，是否是从右到左）（垂直方向时，是否是从下到上） */
    get isArrangeEnd() { return this.viewManager.arrangeAxis == ArrangeAxis.End }
    /** 主轴方向Padding总和 */
    get mainAxisPadding() { return this.isHorizontal ? this.horizontal : this.vertical }
    /** 当前View可视区域的主轴尺寸 */
    get viewMainSize() { return this.scrollManager.view[this.mainAxis.wh] }
    /** 当前View可视区域的交叉轴尺寸 */
    get viewCrossSize() { return this.scrollManager.view[this.crossAxis.wh] }
    /** content主轴尺寸 */
    get contentMainSize() { return this.scrollManager.content[this.mainAxis.wh] }
    /** content交叉轴尺寸 */
    get contentCrossSize() {
        return this.scrollManager.content[this.crossAxis.wh]
    }
    /** 主轴的 Vec2 和 Size 的 key */
    get mainAxis() {
        return {
            xy: this.isHorizontal ? "x" : "y",
            wh: this.isHorizontal ? "width" : "height"
        }
    }
    /** 交叉轴的 Vec2 和 Size 的 key */
    get crossAxis() {
        return {
            xy: this.isHorizontal ? "y" : "x",
            wh: this.isHorizontal ? "height" : "width"
        }
    }
    /** 用于统一计算逻辑使用 */
    get multiplier() {
        var multiplier = this.isHorizontal ? 1 : -1
        return this.isArrangeStart ? -multiplier : multiplier
    }
    protected __preload() {
        this._modelManager["create"](this)
        this.scrollManager["create"](this)
        this.viewManager["create"](this)
        this.layoutManager["create"](this)
        this.pullReleaseManager["create"](this)
        this.autoCenterManager["create"](this)
        this.pageViewManager["create"](this)
        this.nestedManager["create"](this)

        this._modelManager["init"]()
        this.scrollManager["init"]()
        this.viewManager["init"]()
        this.layoutManager["init"]()
        this.pullReleaseManager["init"]()
        this.autoCenterManager["init"]()
        this.pageViewManager["init"]()
        this.nestedManager["init"]()
    }
    protected update(deltaTime: number) {
        this.layoutManager["lateUpdate"](deltaTime)
        this.scrollManager["lateUpdate"](deltaTime)
        this.pullReleaseManager["lateUpdate"](deltaTime)
    }
}

