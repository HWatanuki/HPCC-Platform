import * as React from "react";
import { CommandBar, ContextualMenuItemType, ICommandBarItemProps, ScrollablePane, Sticky } from "@fluentui/react";
import nlsHPCC from "src/nlsHPCC";
import { QuerySortItem } from "src/store/Store";
import { useFluentGrid } from "../hooks/grid";
import { useWorkunitVariables } from "../hooks/workunit";
import { ShortVerticalDivider } from "./Common";

interface VariablesProps {
    wuid: string;
    sort?: QuerySortItem;
}

const defaultSort = { attribute: "Wuid", descending: true };

export const Variables: React.FunctionComponent<VariablesProps> = ({
    wuid,
    sort = defaultSort
}) => {

    const [variables, , , refreshData] = useWorkunitVariables(wuid);
    const [data, setData] = React.useState<any[]>([]);

    //  Grid ---
    const { Grid, copyButtons } = useFluentGrid({
        data,
        primaryID: "__hpcc_id",
        alphaNumColumns: { Name: true, Value: true },
        sort,
        filename: "variables",
        columns: {
            Type: { label: nlsHPCC.Type, width: 180 },
            Name: { label: nlsHPCC.Name, width: 360 },
            Value: { label: nlsHPCC.Value }
        }
    });

    React.useEffect(() => {
        setData(variables.map((row, idx) => {
            return {
                __hpcc_id: idx,
                ...row
            };
        }));
    }, [variables]);

    //  Command Bar  ---
    const buttons = React.useMemo((): ICommandBarItemProps[] => [
        {
            key: "refresh", text: nlsHPCC.Refresh, iconProps: { iconName: "Refresh" },
            onClick: () => refreshData()
        },
        { key: "divider_1", itemType: ContextualMenuItemType.Divider, onRender: () => <ShortVerticalDivider /> },
    ], [refreshData]);

    return <ScrollablePane>
        <Sticky>
            <CommandBar items={buttons} farItems={copyButtons} />
        </Sticky>
        <Grid />
    </ScrollablePane>;
};
