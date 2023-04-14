import * as React from "react";
import * as ReactDOM from "react-dom";
import { Theme, ThemeProvider } from "@fluentui/react";
import { useConst } from "@fluentui/react-hooks";
import { FluentProvider, Theme as ThemeV9 } from "@fluentui/react-components";
import { HTMLWidget, Widget } from "@hpcc-js/common";
import { DockPanel as HPCCDockPanel, IClosable } from "@hpcc-js/phosphor";
import { lightTheme, lightThemeV9 } from "../themes";
import { useUserTheme } from "../hooks/theme";
import { AutosizeHpccJSComponent } from "./HpccJSAdapter";

export class ReactWidget extends HTMLWidget {

    protected _theme: Theme = lightTheme;
    protected _themeV9: ThemeV9 = lightThemeV9;
    protected _children = <div></div>;

    protected _div;

    constructor() {
        super();
    }

    theme(): Theme;
    theme(_: Theme): this;
    theme(_?: Theme): this | Theme {
        if (arguments.length === 0) return this._theme;
        this._theme = _;
        return this;
    }

    themeV9(): ThemeV9;
    themeV9(_: ThemeV9): this;
    themeV9(_?: ThemeV9): this | ThemeV9 {
        if (arguments.length === 0) return this._themeV9;
        this._themeV9 = _;
        return this;
    }

    children(): JSX.Element;
    children(_: JSX.Element): this;
    children(_?: JSX.Element): this | JSX.Element {
        if (arguments.length === 0) return this._children;
        this._children = _;
        return this;
    }

    enter(domNode, element) {
        super.enter(domNode, element);
        this._div = element.append("div");
    }

    private _prevWidth;
    private _prevHeight;
    update(domNode, element) {
        super.update(domNode, element);
        this._div
            .style("width", `${this.width()}px`)
            .style("height", `${this.height()}px`)
            ;

        ReactDOM.render(
            <FluentProvider theme={this._themeV9} style={{ height: "100%" }}>
                <ThemeProvider theme={this._theme} style={{ height: "100%" }}>{this._children}</ThemeProvider>
            </FluentProvider>,
            this._div.node()
        );

        //  TODO:  Hack to make command bar resize...
        if (this._prevWidth !== this.width() || this._prevHeight !== this.height()) {
            this._prevWidth = this.width();
            this._prevHeight = this.height();
            window.dispatchEvent(new Event("resize"));
        }
    }

    exit(domNode, element) {
        ReactDOM.unmountComponentAtNode(
            this._div.node()
        );
        super.enter(domNode, element);
    }

    render(callback?: (w: Widget) => void): this {
        const retVal = super.render(callback);
        return retVal;
    }
}

export interface DockPanelBase {
    title: string;
    location?: "split-top" | "split-left" | "split-right" | "split-bottom" | "tab-before" | "tab-after";
    ref?: string;
    closable?: boolean | IClosable;
}

export interface DockPanelWidget extends DockPanelBase {
    widget?: Widget;
}

export interface DockPanelComponent extends DockPanelBase {
    key: string;
    component?: JSX.Element;
}

function isDockPanelComponent(item: DockPanelWidget | DockPanelComponent): item is DockPanelComponent {
    return !!(item as DockPanelComponent).component;
}

export class ResetableDockPanel extends HPCCDockPanel {

    protected _origLayout;

    render() {
        const retVal = super.render();
        if (this._origLayout === undefined) {
            this._origLayout = this.layout();
        }
        return retVal;
    }

    setLayout(layout: object) {
        if (this._origLayout === undefined) {
            this._origLayout = this.layout();
        }
        this.layout(layout);
        return this;
    }

    resetLayout() {
        if (this._origLayout) {
            this
                .layout(this._origLayout)
                .lazyRender()
                ;
        }
    }
}

export type DockPanelItems = (DockPanelWidget | DockPanelComponent)[];

interface DockPanelProps {
    items?: DockPanelItems,
    layout?: object,
    layoutChanged: (layout: object) => void,
    onDockPanelCreate: (dockpanel: ResetableDockPanel) => void
}

export const DockPanel: React.FunctionComponent<DockPanelProps> = ({
    items,
    layout,
    layoutChanged = layout => { },
    onDockPanelCreate
}) => {

    const { theme, themeV9 } = useUserTheme();
    const [idx, setIdx] = React.useState<{ [key: string]: Widget }>({});

    const dockPanel = useConst(() => {
        const retVal = new ResetableDockPanel();
        const idx: { [key: string]: Widget } = {};
        items.forEach(item => {
            if (isDockPanelComponent(item)) {
                idx[item.key] = new ReactWidget().id(item.key);
                retVal.addWidget(idx[item.key], item.title, item.location, idx[item.ref], item.closable);
            } else if (item.widget) {
                idx[item.widget.id()] = item.widget;
                retVal.addWidget(item.widget, item.title, item.location, idx[item.ref], item.closable);
            }
        });
        setIdx(idx);
        setTimeout(() => {
            onDockPanelCreate(retVal);
        }, 0);
        return retVal;
    });

    React.useEffect(() => {
        if (layout === undefined) {
            dockPanel?.resetLayout();
        } else {
            dockPanel?.setLayout(layout);
        }
    }, [dockPanel, layout]);

    React.useEffect(() => {
        return () => {
            layoutChanged(dockPanel?.layout());
        };
    }, [dockPanel, layoutChanged]);

    React.useEffect(() => {
        items.filter(isDockPanelComponent).forEach(item => {
            (idx[item.key] as ReactWidget)
                .theme(theme)
                .themeV9(themeV9)
                .children(item.component)
                .render()
                ;
        });
    }, [idx, items, theme, themeV9]);

    return <AutosizeHpccJSComponent widget={dockPanel} padding={4} debounce={false} />;
};
