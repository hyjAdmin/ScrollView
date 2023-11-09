import { Holder } from "../abstract/Holder"
import { Layer, WrapMode } from "../enum/enum"
export interface IVec2Like {
    x: number
    y: number
}
export interface ISizeLike {
    width: number
    height: number
}
export interface IAxisKey {
    xy: "x" | "y"
    wh: "width" | "height"
}
export interface IFeature<TModelType = any> {
    /**
     * 数据使用的prefab特征码（用户无需修改）
     */
    code: string
    /**
     * 数据尺寸（用户无需修改）
     */
    size: ISizeLike
    /**
     * 数据缩放（用户无需修改）
     */
    scale: IVec2Like
    /**
     * 数据坐标（用户无需修改）
     */
    position: IVec2Like
    /**
     * 数据锚点（用户无需修改）
     */
    point: IVec2Like
    /**
     * 用户数据
     */
    data: TModelType
    /**
     * 数据索引
     */
    index: number
    /**
     * 布局元素属性
     */
    element: IViewElement
}
export interface IViewInfo {
    /**
     * 单个view所包含的数据列表
     */
    features: IFeature[]
    /**
     * view的虚拟尺寸
     */
    size: ISizeLike
    /**
     * view的虚拟锚点
     */
    point: IVec2Like
    /**
     * 记录了view之前是否被填满
     */
    full: boolean
    /**
     * view索引
     * 注意！这不是数据索引
     */
    viewIndex: number
    /**
     * view是否固定，当holder列表中任何一个设置了fixed时 这个值为ture（用户无需修改）
     */
    fixed: boolean
    /**
     * 布局用 （用户无需修改）
     */
    totalMinSize: ISizeLike
    /**
     * 布局用 （用户无需修改）
     */
    totalPreferredSize: ISizeLike
    /**
     * 布局用 （用户无需修改）
     */
    totalFlexibleSize: ISizeLike
}
export interface IViewFeature {
    /**
     * node 持有者 一旦被创建 node永远不会变，变的只有数据
     */
    holder: Holder<any>
    /**
     * 当前数据的元素布局属性
     */
    viewElement: IViewElement
    /**
     * 数据特征对象，记录一些数据相关的必要数据，用户可以不需要关心
     */
    feature: IFeature
}
export interface IViewElement {
    /**
     * 前换行，当前元素相对于前一个元素的换行模式，默认值 Wrap
     */
    wrapBeforeMode: WrapMode
    /**
     * 后换行，下一个元素相对于自己的换行模式，默认值 Nowrap
     */
    wrapAfterMode: WrapMode
    /**
     * 忽略布局，使其不受Layout控制
     */
    ignoreLayout: boolean
    /**
     * 最小尺寸，如果同时设置了preferredSize则取最大值（只会影响滑动反方向）
     */
    minSize: ISizeLike
    /**
     * 首选尺寸，如果同时设置了minSize则取最大值（只会影响滑动反方向）
     */
    preferredSize: ISizeLike
    /**
     * flex,和CSS flex一样的作用（只会影响滑动反方向）
     */
    flexibleSize: ISizeLike
    /** 
     * 指定当前数据的层级，如果未设置，使用最低层 Lowest
     */
    layer: Layer
    /**
     * 固定到顶部
     */
    fixed: boolean
    /**
     * 开启fixed时有效，固定时顶部的偏移量
     */
    fixedOffset: number
    /**
     * 开启fixed时有效，与下一个设置了fixed的item的间距
     */
    fixedSpacing: number
}