import * as React from "react";
import { CommandBar, ContextualMenuItemType, ICommandBarItemProps, ScrollablePane, ScrollbarVisibility, Sticky, StickyPositionType } from "@fluentui/react";
import { scopedLogger } from "@hpcc-js/util";
import nlsHPCC from "src/nlsHPCC";
import { WUStatus } from "src/react/index";
import { formatCost } from "src/Session";
import { useConfirm } from "../hooks/confirm";
import { useWorkunit } from "../hooks/workunit";
import { ReflexContainer, ReflexElement, ReflexSplitter, classNames, styles } from "../layouts/react-reflex";
import { pushUrl, replaceUrl } from "../util/history";
import { ShortVerticalDivider } from "./Common";
import { TableGroup } from "./forms/Groups";
import { PublishQueryForm } from "./forms/PublishQuery";
import { SlaveLogs } from "./forms/SlaveLogs";
import { ZAPDialog } from "./forms/ZAPDialog";
import { InfoGrid } from "./InfoGrid";
import { WorkunitPersona } from "./controls/StateIcon";

const logger = scopedLogger("../components/WorkunitDetails.tsx");

interface WorkunitSummaryProps {
    wuid: string;
}

export const WorkunitSummary: React.FunctionComponent<WorkunitSummaryProps> = ({
    wuid
}) => {

    const [workunit, , , , refresh] = useWorkunit(wuid, true);
    const [jobname, setJobname] = React.useState("");
    const [description, setDescription] = React.useState("");
    const [_protected, setProtected] = React.useState(false);
    const [showPublishForm, setShowPublishForm] = React.useState(false);
    const [showZapForm, setShowZapForm] = React.useState(false);
    const [showThorSlaveLogs, setShowThorSlaveLogs] = React.useState(false);

    React.useEffect(() => {
        setJobname(workunit?.Jobname);
        setDescription(workunit?.Description);
        setProtected(workunit?.Protected);
    }, [workunit?.Description, workunit?.Jobname, workunit?.Protected]);

    const canSave = workunit && (
        jobname !== workunit.Jobname ||
        description !== workunit.Description ||
        _protected !== workunit.Protected
    );
    const canDelete = workunit && (
        _protected !== workunit.Protected ||
        999 !== workunit.StateID ||
        workunit.Archived
    );
    const canDeschedule = workunit && workunit?.EventSchedule === 2;
    const canReschedule = workunit && workunit?.EventSchedule === 1;

    const [DeleteConfirm, setShowDeleteConfirm] = useConfirm({
        title: nlsHPCC.Delete,
        message: nlsHPCC.YouAreAboutToDeleteThisWorkunit,
        onSubmit: React.useCallback(() => {
            workunit?.delete()
                .then(response => replaceUrl("/workunits"))
                .catch(err => logger.error(err))
                ;
        }, [workunit])
    });

    const buttons = React.useMemo((): ICommandBarItemProps[] => [
        {
            key: "refresh", text: nlsHPCC.Refresh, iconProps: { iconName: "Refresh" },
            onClick: () => {
                refresh(true);
            }
        },
        {
            key: "copy", text: nlsHPCC.CopyWUID, iconProps: { iconName: "Copy" },
            onClick: () => {
                navigator?.clipboard?.writeText(wuid);
            }
        },
        { key: "divider_1", itemType: ContextualMenuItemType.Divider, onRender: () => <ShortVerticalDivider /> },
        {
            key: "save", text: nlsHPCC.Save, iconProps: { iconName: "Save" }, disabled: !canSave,
            onClick: () => {
                workunit?.update({
                    Jobname: jobname,
                    Description: description,
                    Protected: _protected
                }).catch(err => logger.error(err));
            }
        },
        {
            key: "delete", text: nlsHPCC.Delete, iconProps: { iconName: "Delete" }, disabled: !canDelete,
            onClick: () => setShowDeleteConfirm(true)
        },
        {
            key: "restore", text: nlsHPCC.Restore, disabled: !workunit?.Archived,
            onClick: () => workunit?.restore().catch(err => logger.error(err))

        },
        { key: "divider_2", itemType: ContextualMenuItemType.Divider, onRender: () => <ShortVerticalDivider /> },
        {
            key: "reschedule", text: nlsHPCC.Reschedule, disabled: !canReschedule,
            onClick: () => workunit?.reschedule().catch(err => logger.error(err))
        },
        {
            key: "deschedule", text: nlsHPCC.Deschedule, disabled: !canDeschedule,
            onClick: () => workunit?.deschedule().catch(err => logger.error(err))
        },
        { key: "divider_3", itemType: ContextualMenuItemType.Divider, onRender: () => <ShortVerticalDivider /> },
        {
            key: "setToFailed", text: nlsHPCC.SetToFailed, disabled: workunit?.Archived || workunit?.isComplete() || workunit?.isDeleted(),
            onClick: () => workunit?.setToFailed().catch(err => logger.error(err))
        },
        {
            key: "abort", text: nlsHPCC.Abort, disabled: workunit?.Archived || workunit?.isComplete() || workunit?.isDeleted(),
            onClick: () => workunit?.abort().catch(err => logger.error(err))
        },
        { key: "divider_4", itemType: ContextualMenuItemType.Divider, onRender: () => <ShortVerticalDivider /> },
        {
            key: "recover", text: nlsHPCC.Recover, disabled: workunit?.Archived || !workunit?.isComplete() || workunit?.isDeleted(),
            onClick: () => workunit?.resubmit().catch(err => logger.error(err))
        },
        {
            key: "resubmit", text: nlsHPCC.Resubmit, disabled: workunit?.Archived || !workunit?.isComplete() || workunit?.isDeleted(),
            onClick: () => workunit?.resubmit().catch(err => logger.error(err))
        },
        {
            key: "clone", text: nlsHPCC.Clone, disabled: workunit?.Archived || !workunit?.isComplete() || workunit?.isDeleted(),
            onClick: () => {
                workunit?.clone().then(wu => {
                    if (wu && wu.Wuid) {
                        pushUrl(`/workunits/${wu?.Wuid}`);
                    }
                }).catch(err => logger.error(err));
            }
        },
        { key: "divider_5", itemType: ContextualMenuItemType.Divider, onRender: () => <ShortVerticalDivider /> },
        {
            key: "publish", text: nlsHPCC.Publish,
            onClick: () => setShowPublishForm(true)
        },
        { key: "divider_6", itemType: ContextualMenuItemType.Divider, onRender: () => <ShortVerticalDivider /> },
        {
            key: "zap", text: nlsHPCC.ZAP, disabled: !canDelete,
            onClick: () => setShowZapForm(true)
        },
        { key: "divider_7", itemType: ContextualMenuItemType.Divider, onRender: () => <ShortVerticalDivider /> },
        {
            key: "slaveLogs", text: nlsHPCC.SlaveLogs, disabled: !workunit?.ThorLogList,
            onClick: () => setShowThorSlaveLogs(true)
        },
    ], [_protected, canDelete, canDeschedule, canReschedule, canSave, description, jobname, refresh, setShowDeleteConfirm, workunit, wuid]);

    const serviceNames = React.useMemo(() => {
        return workunit?.ServiceNames?.Item?.join("\n") || "";
    }, [workunit?.ServiceNames?.Item]);

    return <>
        <div style={{ height: "100%", position: "relative" }}>
            <ReflexContainer orientation="horizontal">
                <ReflexElement className={classNames.reflexScrollPane}>
                    <div className="pane-content">
                        <ScrollablePane scrollbarVisibility={ScrollbarVisibility.auto}>
                            <Sticky stickyPosition={StickyPositionType.Header}>
                                <CommandBar items={buttons} />
                            </Sticky>
                            <Sticky stickyPosition={StickyPositionType.Header}>
                                <WorkunitPersona wuid={wuid} />
                                <div style={{ width: "512px", height: "64px", float: "right" }}>
                                    <WUStatus wuid={wuid}></WUStatus>
                                </div>
                            </Sticky>
                            <TableGroup fields={{
                                "wuid": { label: nlsHPCC.WUID, type: "string", value: wuid, readonly: true },
                                "action": { label: nlsHPCC.Action, type: "string", value: workunit?.ActionEx, readonly: true },
                                "state": { label: nlsHPCC.State, type: "string", value: workunit?.State + (workunit?.StateEx ? ` (${workunit.StateEx})` : ""), readonly: true },
                                "owner": { label: nlsHPCC.Owner, type: "string", value: workunit?.Owner, readonly: true },
                                "jobname": { label: nlsHPCC.JobName, type: "string", value: jobname },
                                "description": { label: nlsHPCC.Description, type: "string", value: description },
                                "compileCost": { label: nlsHPCC.CompileCost, type: "string", value: `${formatCost(workunit?.CompileCost)}`, readonly: true },
                                "executeCost": { label: nlsHPCC.ExecuteCost, type: "string", value: `${formatCost(workunit?.ExecuteCost)}`, readonly: true },
                                "fileAccessCost": { label: nlsHPCC.FileAccessCost, type: "string", value: `${formatCost(workunit?.FileAccessCost)}`, readonly: true },
                                "protected": { label: nlsHPCC.Protected, type: "checkbox", value: _protected },
                                "cluster": { label: nlsHPCC.Cluster, type: "string", value: workunit?.Cluster, readonly: true },
                                "totalClusterTime": { label: nlsHPCC.TotalClusterTime, type: "string", value: workunit?.TotalClusterTime, readonly: true },
                                "abortedBy": { label: nlsHPCC.AbortedBy, type: "string", value: workunit?.AbortBy, readonly: true },
                                "abortedTime": { label: nlsHPCC.AbortedTime, type: "string", value: workunit?.AbortTime, readonly: true },
                                "ServiceNamesCustom": { label: nlsHPCC.Services, type: "string", value: serviceNames, readonly: true, multiline: true },
                            }} onChange={(id, value) => {
                                switch (id) {
                                    case "jobname":
                                        setJobname(value);
                                        break;
                                    case "description":
                                        setDescription(value);
                                        break;
                                    case "protected":
                                        setProtected(value);
                                        break;
                                    default:
                                        logger.debug(`${id}:  ${value}`);
                                }
                            }} />
                        </ScrollablePane>
                    </div>
                </ReflexElement>
                <ReflexSplitter style={styles.reflexSplitter}>
                    <div className={classNames.reflexSplitterDiv}></div>
                </ReflexSplitter>
                <ReflexElement propagateDimensions={true} className={classNames.reflexPane} style={{ overflow: "hidden" }}>
                    <InfoGrid wuid={wuid}></InfoGrid>
                </ReflexElement>
            </ReflexContainer>
        </div>
        <PublishQueryForm wuid={wuid} showForm={showPublishForm} setShowForm={setShowPublishForm} />
        <ZAPDialog wuid={wuid} showForm={showZapForm} setShowForm={setShowZapForm} />
        <SlaveLogs wuid={wuid} showForm={showThorSlaveLogs} setShowForm={setShowThorSlaveLogs} />
        <DeleteConfirm />
    </>;
};
