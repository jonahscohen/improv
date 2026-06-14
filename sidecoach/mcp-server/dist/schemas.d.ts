import { z } from 'zod';
export declare const listVerbsShape: {
    phase: z.ZodOptional<z.ZodString>;
};
export declare const ListVerbsInput: z.ZodObject<{
    phase: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    phase?: string | undefined;
}, {
    phase?: string | undefined;
}>;
export type ListVerbsInputT = z.infer<typeof ListVerbsInput>;
export declare const listLanesShape: {};
export declare const ListLanesInput: z.ZodObject<{}, "strip", z.ZodTypeAny, {}, {}>;
export type ListLanesInputT = z.infer<typeof ListLanesInput>;
export declare const listFlowsShape: {
    tier: z.ZodOptional<z.ZodNumber>;
    idPrefix: z.ZodOptional<z.ZodString>;
};
export declare const ListFlowsInput: z.ZodObject<{
    tier: z.ZodOptional<z.ZodNumber>;
    idPrefix: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    tier?: number | undefined;
    idPrefix?: string | undefined;
}, {
    tier?: number | undefined;
    idPrefix?: string | undefined;
}>;
export type ListFlowsInputT = z.infer<typeof ListFlowsInput>;
export declare const classifyIntentShape: {
    prompt: z.ZodString;
};
export declare const ClassifyIntentInput: z.ZodObject<{
    prompt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    prompt: string;
}, {
    prompt: string;
}>;
export type ClassifyIntentInputT = z.infer<typeof ClassifyIntentInput>;
export declare const validatePolishShape: {
    html: z.ZodOptional<z.ZodString>;
    css: z.ZodOptional<z.ZodString>;
    designTokens: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    contextOverrides: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
};
export declare const ValidatePolishInput: z.ZodEffects<z.ZodObject<{
    html: z.ZodOptional<z.ZodString>;
    css: z.ZodOptional<z.ZodString>;
    designTokens: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    contextOverrides: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, "strip", z.ZodTypeAny, {
    html?: string | undefined;
    css?: string | undefined;
    designTokens?: Record<string, unknown> | undefined;
    contextOverrides?: Record<string, unknown> | undefined;
}, {
    html?: string | undefined;
    css?: string | undefined;
    designTokens?: Record<string, unknown> | undefined;
    contextOverrides?: Record<string, unknown> | undefined;
}>, {
    html?: string | undefined;
    css?: string | undefined;
    designTokens?: Record<string, unknown> | undefined;
    contextOverrides?: Record<string, unknown> | undefined;
}, {
    html?: string | undefined;
    css?: string | undefined;
    designTokens?: Record<string, unknown> | undefined;
    contextOverrides?: Record<string, unknown> | undefined;
}>;
export type ValidatePolishInputT = z.infer<typeof ValidatePolishInput>;
export declare const validateExtendedDomainShape: {
    html: z.ZodOptional<z.ZodString>;
    css: z.ZodOptional<z.ZodString>;
    designTokens: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    typography: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    colors: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    spacing: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    motion: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    accessibility: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    contrast: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    performance: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    visualization: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    internationalization: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
};
export declare const ValidateExtendedDomainInput: z.ZodObject<{
    html: z.ZodOptional<z.ZodString>;
    css: z.ZodOptional<z.ZodString>;
    designTokens: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    typography: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    colors: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    spacing: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    motion: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    accessibility: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    contrast: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    performance: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    visualization: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    internationalization: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, "strip", z.ZodTypeAny, {
    html?: string | undefined;
    css?: string | undefined;
    designTokens?: Record<string, unknown> | undefined;
    typography?: Record<string, unknown> | undefined;
    colors?: Record<string, unknown> | undefined;
    spacing?: Record<string, unknown> | undefined;
    motion?: Record<string, unknown> | undefined;
    accessibility?: Record<string, unknown> | undefined;
    contrast?: Record<string, unknown> | undefined;
    performance?: Record<string, unknown> | undefined;
    visualization?: Record<string, unknown> | undefined;
    internationalization?: Record<string, unknown> | undefined;
}, {
    html?: string | undefined;
    css?: string | undefined;
    designTokens?: Record<string, unknown> | undefined;
    typography?: Record<string, unknown> | undefined;
    colors?: Record<string, unknown> | undefined;
    spacing?: Record<string, unknown> | undefined;
    motion?: Record<string, unknown> | undefined;
    accessibility?: Record<string, unknown> | undefined;
    contrast?: Record<string, unknown> | undefined;
    performance?: Record<string, unknown> | undefined;
    visualization?: Record<string, unknown> | undefined;
    internationalization?: Record<string, unknown> | undefined;
}>;
export type ValidateExtendedDomainInputT = z.infer<typeof ValidateExtendedDomainInput>;
export declare const validateTasteShape: {
    html: z.ZodString;
    css: z.ZodOptional<z.ZodString>;
    iconLibrary: z.ZodOptional<z.ZodString>;
};
export declare const ValidateTasteInput: z.ZodObject<{
    html: z.ZodString;
    css: z.ZodOptional<z.ZodString>;
    iconLibrary: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    html: string;
    css?: string | undefined;
    iconLibrary?: string | undefined;
}, {
    html: string;
    css?: string | undefined;
    iconLibrary?: string | undefined;
}>;
export type ValidateTasteInputT = z.infer<typeof ValidateTasteInput>;
export declare const getCostLedgerShape: {
    format: z.ZodOptional<z.ZodEnum<["raw", "summary"]>>;
};
export declare const GetCostLedgerInput: z.ZodObject<{
    format: z.ZodOptional<z.ZodEnum<["raw", "summary"]>>;
}, "strip", z.ZodTypeAny, {
    format?: "raw" | "summary" | undefined;
}, {
    format?: "raw" | "summary" | undefined;
}>;
export type GetCostLedgerInputT = z.infer<typeof GetCostLedgerInput>;
export declare const getCheatsheetShape: {
    section: z.ZodOptional<z.ZodEnum<["lanes", "verbs", "flows", "routing", "all"]>>;
};
export declare const GetCheatsheetInput: z.ZodObject<{
    section: z.ZodOptional<z.ZodEnum<["lanes", "verbs", "flows", "routing", "all"]>>;
}, "strip", z.ZodTypeAny, {
    section?: "verbs" | "lanes" | "flows" | "routing" | "all" | undefined;
}, {
    section?: "verbs" | "lanes" | "flows" | "routing" | "all" | undefined;
}>;
export type GetCheatsheetInputT = z.infer<typeof GetCheatsheetInput>;
export declare const getFlowMetadataShape: {
    flowId: z.ZodString;
};
export declare const GetFlowMetadataInput: z.ZodObject<{
    flowId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    flowId: string;
}, {
    flowId: string;
}>;
export type GetFlowMetadataInputT = z.infer<typeof GetFlowMetadataInput>;
export declare const laneShape: {
    operation: z.ZodEnum<["start", "advance", "status", "list"]>;
    projectPath: z.ZodOptional<z.ZodString>;
    laneId: z.ZodOptional<z.ZodString>;
    target: z.ZodOptional<z.ZodString>;
    renderUrl: z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>;
    startRequestId: z.ZodOptional<z.ZodString>;
    checkpointId: z.ZodOptional<z.ZodString>;
    action: z.ZodOptional<z.ZodEnum<["complete", "retry", "skip", "resume", "interrupt", "stop"]>>;
    expectedRevision: z.ZodOptional<z.ZodNumber>;
    reason: z.ZodOptional<z.ZodString>;
    report: z.ZodOptional<z.ZodObject<{
        stepId: z.ZodString;
        iteration: z.ZodNumber;
        reportId: z.ZodString;
        verb: z.ZodString;
        summary: z.ZodString;
        evidence: z.ZodArray<z.ZodObject<{
            kind: z.ZodEnum<["files", "screenshot", "validation", "note"]>;
            detail: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            kind: "validation" | "files" | "screenshot" | "note";
            detail: string;
        }, {
            kind: "validation" | "files" | "screenshot" | "note";
            detail: string;
        }>, "many">;
        checklistResults: z.ZodOptional<z.ZodArray<z.ZodObject<{
            itemId: z.ZodString;
            done: z.ZodBoolean;
        }, "strip", z.ZodTypeAny, {
            itemId: string;
            done: boolean;
        }, {
            itemId: string;
            done: boolean;
        }>, "many">>;
    }, "strip", z.ZodTypeAny, {
        verb: string;
        summary: string;
        stepId: string;
        iteration: number;
        reportId: string;
        evidence: {
            kind: "validation" | "files" | "screenshot" | "note";
            detail: string;
        }[];
        checklistResults?: {
            itemId: string;
            done: boolean;
        }[] | undefined;
    }, {
        verb: string;
        summary: string;
        stepId: string;
        iteration: number;
        reportId: string;
        evidence: {
            kind: "validation" | "files" | "screenshot" | "note";
            detail: string;
        }[];
        checklistResults?: {
            itemId: string;
            done: boolean;
        }[] | undefined;
    }>>;
    all: z.ZodOptional<z.ZodBoolean>;
};
export declare const LaneInput: z.ZodEffects<z.ZodEffects<z.ZodEffects<z.ZodEffects<z.ZodEffects<z.ZodObject<{
    operation: z.ZodEnum<["start", "advance", "status", "list"]>;
    projectPath: z.ZodOptional<z.ZodString>;
    laneId: z.ZodOptional<z.ZodString>;
    target: z.ZodOptional<z.ZodString>;
    renderUrl: z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>;
    startRequestId: z.ZodOptional<z.ZodString>;
    checkpointId: z.ZodOptional<z.ZodString>;
    action: z.ZodOptional<z.ZodEnum<["complete", "retry", "skip", "resume", "interrupt", "stop"]>>;
    expectedRevision: z.ZodOptional<z.ZodNumber>;
    reason: z.ZodOptional<z.ZodString>;
    report: z.ZodOptional<z.ZodObject<{
        stepId: z.ZodString;
        iteration: z.ZodNumber;
        reportId: z.ZodString;
        verb: z.ZodString;
        summary: z.ZodString;
        evidence: z.ZodArray<z.ZodObject<{
            kind: z.ZodEnum<["files", "screenshot", "validation", "note"]>;
            detail: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            kind: "validation" | "files" | "screenshot" | "note";
            detail: string;
        }, {
            kind: "validation" | "files" | "screenshot" | "note";
            detail: string;
        }>, "many">;
        checklistResults: z.ZodOptional<z.ZodArray<z.ZodObject<{
            itemId: z.ZodString;
            done: z.ZodBoolean;
        }, "strip", z.ZodTypeAny, {
            itemId: string;
            done: boolean;
        }, {
            itemId: string;
            done: boolean;
        }>, "many">>;
    }, "strip", z.ZodTypeAny, {
        verb: string;
        summary: string;
        stepId: string;
        iteration: number;
        reportId: string;
        evidence: {
            kind: "validation" | "files" | "screenshot" | "note";
            detail: string;
        }[];
        checklistResults?: {
            itemId: string;
            done: boolean;
        }[] | undefined;
    }, {
        verb: string;
        summary: string;
        stepId: string;
        iteration: number;
        reportId: string;
        evidence: {
            kind: "validation" | "files" | "screenshot" | "note";
            detail: string;
        }[];
        checklistResults?: {
            itemId: string;
            done: boolean;
        }[] | undefined;
    }>>;
    all: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    operation: "start" | "status" | "advance" | "list";
    all?: boolean | undefined;
    projectPath?: string | undefined;
    laneId?: string | undefined;
    target?: string | undefined;
    renderUrl?: string | undefined;
    startRequestId?: string | undefined;
    checkpointId?: string | undefined;
    action?: "stop" | "complete" | "retry" | "skip" | "resume" | "interrupt" | undefined;
    expectedRevision?: number | undefined;
    reason?: string | undefined;
    report?: {
        verb: string;
        summary: string;
        stepId: string;
        iteration: number;
        reportId: string;
        evidence: {
            kind: "validation" | "files" | "screenshot" | "note";
            detail: string;
        }[];
        checklistResults?: {
            itemId: string;
            done: boolean;
        }[] | undefined;
    } | undefined;
}, {
    operation: "start" | "status" | "advance" | "list";
    all?: boolean | undefined;
    projectPath?: string | undefined;
    laneId?: string | undefined;
    target?: string | undefined;
    renderUrl?: string | undefined;
    startRequestId?: string | undefined;
    checkpointId?: string | undefined;
    action?: "stop" | "complete" | "retry" | "skip" | "resume" | "interrupt" | undefined;
    expectedRevision?: number | undefined;
    reason?: string | undefined;
    report?: {
        verb: string;
        summary: string;
        stepId: string;
        iteration: number;
        reportId: string;
        evidence: {
            kind: "validation" | "files" | "screenshot" | "note";
            detail: string;
        }[];
        checklistResults?: {
            itemId: string;
            done: boolean;
        }[] | undefined;
    } | undefined;
}>, {
    operation: "start" | "status" | "advance" | "list";
    all?: boolean | undefined;
    projectPath?: string | undefined;
    laneId?: string | undefined;
    target?: string | undefined;
    renderUrl?: string | undefined;
    startRequestId?: string | undefined;
    checkpointId?: string | undefined;
    action?: "stop" | "complete" | "retry" | "skip" | "resume" | "interrupt" | undefined;
    expectedRevision?: number | undefined;
    reason?: string | undefined;
    report?: {
        verb: string;
        summary: string;
        stepId: string;
        iteration: number;
        reportId: string;
        evidence: {
            kind: "validation" | "files" | "screenshot" | "note";
            detail: string;
        }[];
        checklistResults?: {
            itemId: string;
            done: boolean;
        }[] | undefined;
    } | undefined;
}, {
    operation: "start" | "status" | "advance" | "list";
    all?: boolean | undefined;
    projectPath?: string | undefined;
    laneId?: string | undefined;
    target?: string | undefined;
    renderUrl?: string | undefined;
    startRequestId?: string | undefined;
    checkpointId?: string | undefined;
    action?: "stop" | "complete" | "retry" | "skip" | "resume" | "interrupt" | undefined;
    expectedRevision?: number | undefined;
    reason?: string | undefined;
    report?: {
        verb: string;
        summary: string;
        stepId: string;
        iteration: number;
        reportId: string;
        evidence: {
            kind: "validation" | "files" | "screenshot" | "note";
            detail: string;
        }[];
        checklistResults?: {
            itemId: string;
            done: boolean;
        }[] | undefined;
    } | undefined;
}>, {
    operation: "start" | "status" | "advance" | "list";
    all?: boolean | undefined;
    projectPath?: string | undefined;
    laneId?: string | undefined;
    target?: string | undefined;
    renderUrl?: string | undefined;
    startRequestId?: string | undefined;
    checkpointId?: string | undefined;
    action?: "stop" | "complete" | "retry" | "skip" | "resume" | "interrupt" | undefined;
    expectedRevision?: number | undefined;
    reason?: string | undefined;
    report?: {
        verb: string;
        summary: string;
        stepId: string;
        iteration: number;
        reportId: string;
        evidence: {
            kind: "validation" | "files" | "screenshot" | "note";
            detail: string;
        }[];
        checklistResults?: {
            itemId: string;
            done: boolean;
        }[] | undefined;
    } | undefined;
}, {
    operation: "start" | "status" | "advance" | "list";
    all?: boolean | undefined;
    projectPath?: string | undefined;
    laneId?: string | undefined;
    target?: string | undefined;
    renderUrl?: string | undefined;
    startRequestId?: string | undefined;
    checkpointId?: string | undefined;
    action?: "stop" | "complete" | "retry" | "skip" | "resume" | "interrupt" | undefined;
    expectedRevision?: number | undefined;
    reason?: string | undefined;
    report?: {
        verb: string;
        summary: string;
        stepId: string;
        iteration: number;
        reportId: string;
        evidence: {
            kind: "validation" | "files" | "screenshot" | "note";
            detail: string;
        }[];
        checklistResults?: {
            itemId: string;
            done: boolean;
        }[] | undefined;
    } | undefined;
}>, {
    operation: "start" | "status" | "advance" | "list";
    all?: boolean | undefined;
    projectPath?: string | undefined;
    laneId?: string | undefined;
    target?: string | undefined;
    renderUrl?: string | undefined;
    startRequestId?: string | undefined;
    checkpointId?: string | undefined;
    action?: "stop" | "complete" | "retry" | "skip" | "resume" | "interrupt" | undefined;
    expectedRevision?: number | undefined;
    reason?: string | undefined;
    report?: {
        verb: string;
        summary: string;
        stepId: string;
        iteration: number;
        reportId: string;
        evidence: {
            kind: "validation" | "files" | "screenshot" | "note";
            detail: string;
        }[];
        checklistResults?: {
            itemId: string;
            done: boolean;
        }[] | undefined;
    } | undefined;
}, {
    operation: "start" | "status" | "advance" | "list";
    all?: boolean | undefined;
    projectPath?: string | undefined;
    laneId?: string | undefined;
    target?: string | undefined;
    renderUrl?: string | undefined;
    startRequestId?: string | undefined;
    checkpointId?: string | undefined;
    action?: "stop" | "complete" | "retry" | "skip" | "resume" | "interrupt" | undefined;
    expectedRevision?: number | undefined;
    reason?: string | undefined;
    report?: {
        verb: string;
        summary: string;
        stepId: string;
        iteration: number;
        reportId: string;
        evidence: {
            kind: "validation" | "files" | "screenshot" | "note";
            detail: string;
        }[];
        checklistResults?: {
            itemId: string;
            done: boolean;
        }[] | undefined;
    } | undefined;
}>, {
    operation: "start" | "status" | "advance" | "list";
    all?: boolean | undefined;
    projectPath?: string | undefined;
    laneId?: string | undefined;
    target?: string | undefined;
    renderUrl?: string | undefined;
    startRequestId?: string | undefined;
    checkpointId?: string | undefined;
    action?: "stop" | "complete" | "retry" | "skip" | "resume" | "interrupt" | undefined;
    expectedRevision?: number | undefined;
    reason?: string | undefined;
    report?: {
        verb: string;
        summary: string;
        stepId: string;
        iteration: number;
        reportId: string;
        evidence: {
            kind: "validation" | "files" | "screenshot" | "note";
            detail: string;
        }[];
        checklistResults?: {
            itemId: string;
            done: boolean;
        }[] | undefined;
    } | undefined;
}, {
    operation: "start" | "status" | "advance" | "list";
    all?: boolean | undefined;
    projectPath?: string | undefined;
    laneId?: string | undefined;
    target?: string | undefined;
    renderUrl?: string | undefined;
    startRequestId?: string | undefined;
    checkpointId?: string | undefined;
    action?: "stop" | "complete" | "retry" | "skip" | "resume" | "interrupt" | undefined;
    expectedRevision?: number | undefined;
    reason?: string | undefined;
    report?: {
        verb: string;
        summary: string;
        stepId: string;
        iteration: number;
        reportId: string;
        evidence: {
            kind: "validation" | "files" | "screenshot" | "note";
            detail: string;
        }[];
        checklistResults?: {
            itemId: string;
            done: boolean;
        }[] | undefined;
    } | undefined;
}>, {
    operation: "start" | "status" | "advance" | "list";
    all?: boolean | undefined;
    projectPath?: string | undefined;
    laneId?: string | undefined;
    target?: string | undefined;
    renderUrl?: string | undefined;
    startRequestId?: string | undefined;
    checkpointId?: string | undefined;
    action?: "stop" | "complete" | "retry" | "skip" | "resume" | "interrupt" | undefined;
    expectedRevision?: number | undefined;
    reason?: string | undefined;
    report?: {
        verb: string;
        summary: string;
        stepId: string;
        iteration: number;
        reportId: string;
        evidence: {
            kind: "validation" | "files" | "screenshot" | "note";
            detail: string;
        }[];
        checklistResults?: {
            itemId: string;
            done: boolean;
        }[] | undefined;
    } | undefined;
}, {
    operation: "start" | "status" | "advance" | "list";
    all?: boolean | undefined;
    projectPath?: string | undefined;
    laneId?: string | undefined;
    target?: string | undefined;
    renderUrl?: string | undefined;
    startRequestId?: string | undefined;
    checkpointId?: string | undefined;
    action?: "stop" | "complete" | "retry" | "skip" | "resume" | "interrupt" | undefined;
    expectedRevision?: number | undefined;
    reason?: string | undefined;
    report?: {
        verb: string;
        summary: string;
        stepId: string;
        iteration: number;
        reportId: string;
        evidence: {
            kind: "validation" | "files" | "screenshot" | "note";
            detail: string;
        }[];
        checklistResults?: {
            itemId: string;
            done: boolean;
        }[] | undefined;
    } | undefined;
}>;
export type LaneInputT = z.infer<typeof LaneInput>;
export declare const stateSetShape: {
    key: z.ZodString;
    value: z.ZodString;
    ttlMs: z.ZodOptional<z.ZodNumber>;
};
export declare const StateSetInput: z.ZodObject<{
    key: z.ZodString;
    value: z.ZodString;
    ttlMs: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    value: string;
    key: string;
    ttlMs?: number | undefined;
}, {
    value: string;
    key: string;
    ttlMs?: number | undefined;
}>;
export type StateSetInputT = z.infer<typeof StateSetInput>;
export declare const stateGetShape: {
    key: z.ZodString;
};
export declare const StateGetInput: z.ZodObject<{
    key: z.ZodString;
}, "strip", z.ZodTypeAny, {
    key: string;
}, {
    key: string;
}>;
export type StateGetInputT = z.infer<typeof StateGetInput>;
export declare const stateDeleteShape: {
    key: z.ZodString;
};
export declare const StateDeleteInput: z.ZodObject<{
    key: z.ZodString;
}, "strip", z.ZodTypeAny, {
    key: string;
}, {
    key: string;
}>;
export type StateDeleteInputT = z.infer<typeof StateDeleteInput>;
export declare const stateListKeysShape: {
    prefix: z.ZodOptional<z.ZodString>;
};
export declare const StateListKeysInput: z.ZodObject<{
    prefix: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    prefix?: string | undefined;
}, {
    prefix?: string | undefined;
}>;
export type StateListKeysInputT = z.infer<typeof StateListKeysInput>;
/** Languages accepted by the ast-grep CLI we ship. */
export declare const AST_GREP_LANGUAGES: readonly ["javascript", "typescript", "tsx", "python", "go", "rust", "java", "c", "cpp", "html", "css", "json", "yaml"];
export declare const astGrepShape: {
    pattern: z.ZodString;
    language: z.ZodOptional<z.ZodEnum<["javascript", "typescript", "tsx", "python", "go", "rust", "java", "c", "cpp", "html", "css", "json", "yaml"]>>;
    path: z.ZodOptional<z.ZodString>;
    maxResults: z.ZodOptional<z.ZodNumber>;
};
export declare const AstGrepInput: z.ZodObject<{
    pattern: z.ZodString;
    language: z.ZodOptional<z.ZodEnum<["javascript", "typescript", "tsx", "python", "go", "rust", "java", "c", "cpp", "html", "css", "json", "yaml"]>>;
    path: z.ZodOptional<z.ZodString>;
    maxResults: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    pattern: string;
    language?: "html" | "css" | "javascript" | "typescript" | "tsx" | "python" | "go" | "rust" | "java" | "c" | "cpp" | "json" | "yaml" | undefined;
    path?: string | undefined;
    maxResults?: number | undefined;
}, {
    pattern: string;
    language?: "html" | "css" | "javascript" | "typescript" | "tsx" | "python" | "go" | "rust" | "java" | "c" | "cpp" | "json" | "yaml" | undefined;
    path?: string | undefined;
    maxResults?: number | undefined;
}>;
export type AstGrepInputT = z.infer<typeof AstGrepInput>;
export declare const LSP_LANGUAGES: readonly ["typescript", "javascript", "go", "rust", "python", "c", "cpp"];
export declare const lspHoverShape: {
    file: z.ZodString;
    line: z.ZodNumber;
    character: z.ZodNumber;
};
export declare const LspHoverInput: z.ZodObject<{
    file: z.ZodString;
    line: z.ZodNumber;
    character: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    file: string;
    line: number;
    character: number;
}, {
    file: string;
    line: number;
    character: number;
}>;
export type LspHoverInputT = z.infer<typeof LspHoverInput>;
export declare const lspGotoDefinitionShape: {
    file: z.ZodString;
    line: z.ZodNumber;
    character: z.ZodNumber;
};
export declare const LspGotoDefinitionInput: z.ZodObject<{
    file: z.ZodString;
    line: z.ZodNumber;
    character: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    file: string;
    line: number;
    character: number;
}, {
    file: string;
    line: number;
    character: number;
}>;
export type LspGotoDefinitionInputT = z.infer<typeof LspGotoDefinitionInput>;
export declare const lspFindReferencesShape: {
    file: z.ZodString;
    line: z.ZodNumber;
    character: z.ZodNumber;
    includeDeclaration: z.ZodOptional<z.ZodBoolean>;
};
export declare const LspFindReferencesInput: z.ZodObject<{
    file: z.ZodString;
    line: z.ZodNumber;
    character: z.ZodNumber;
    includeDeclaration: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    file: string;
    line: number;
    character: number;
    includeDeclaration?: boolean | undefined;
}, {
    file: string;
    line: number;
    character: number;
    includeDeclaration?: boolean | undefined;
}>;
export type LspFindReferencesInputT = z.infer<typeof LspFindReferencesInput>;
export declare const lspDocumentSymbolsShape: {
    file: z.ZodString;
};
export declare const LspDocumentSymbolsInput: z.ZodObject<{
    file: z.ZodString;
}, "strip", z.ZodTypeAny, {
    file: string;
}, {
    file: string;
}>;
export type LspDocumentSymbolsInputT = z.infer<typeof LspDocumentSymbolsInput>;
export declare const lspWorkspaceSymbolsShape: {
    query: z.ZodString;
    language: z.ZodOptional<z.ZodEnum<["typescript", "javascript", "go", "rust", "python", "c", "cpp"]>>;
    file: z.ZodOptional<z.ZodString>;
};
export declare const LspWorkspaceSymbolsInput: z.ZodObject<{
    query: z.ZodString;
    language: z.ZodOptional<z.ZodEnum<["typescript", "javascript", "go", "rust", "python", "c", "cpp"]>>;
    file: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    query: string;
    file?: string | undefined;
    language?: "javascript" | "typescript" | "python" | "go" | "rust" | "c" | "cpp" | undefined;
}, {
    query: string;
    file?: string | undefined;
    language?: "javascript" | "typescript" | "python" | "go" | "rust" | "c" | "cpp" | undefined;
}>;
export type LspWorkspaceSymbolsInputT = z.infer<typeof LspWorkspaceSymbolsInput>;
export declare const pythonReplExecuteShape: {
    code: z.ZodString;
    timeoutMs: z.ZodOptional<z.ZodNumber>;
};
export declare const PythonReplExecuteInput: z.ZodObject<{
    code: z.ZodString;
    timeoutMs: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    code: string;
    timeoutMs?: number | undefined;
}, {
    code: string;
    timeoutMs?: number | undefined;
}>;
export type PythonReplExecuteInputT = z.infer<typeof PythonReplExecuteInput>;
export declare const TOOL_INPUT_SCHEMAS: {
    readonly sidecoach_list_verbs: z.ZodObject<{
        phase: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        phase?: string | undefined;
    }, {
        phase?: string | undefined;
    }>;
    readonly sidecoach_list_lanes: z.ZodObject<{}, "strip", z.ZodTypeAny, {}, {}>;
    readonly sidecoach_classify_intent: z.ZodObject<{
        prompt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        prompt: string;
    }, {
        prompt: string;
    }>;
    readonly sidecoach_lane: z.ZodEffects<z.ZodEffects<z.ZodEffects<z.ZodEffects<z.ZodEffects<z.ZodObject<{
        operation: z.ZodEnum<["start", "advance", "status", "list"]>;
        projectPath: z.ZodOptional<z.ZodString>;
        laneId: z.ZodOptional<z.ZodString>;
        target: z.ZodOptional<z.ZodString>;
        renderUrl: z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>;
        startRequestId: z.ZodOptional<z.ZodString>;
        checkpointId: z.ZodOptional<z.ZodString>;
        action: z.ZodOptional<z.ZodEnum<["complete", "retry", "skip", "resume", "interrupt", "stop"]>>;
        expectedRevision: z.ZodOptional<z.ZodNumber>;
        reason: z.ZodOptional<z.ZodString>;
        report: z.ZodOptional<z.ZodObject<{
            stepId: z.ZodString;
            iteration: z.ZodNumber;
            reportId: z.ZodString;
            verb: z.ZodString;
            summary: z.ZodString;
            evidence: z.ZodArray<z.ZodObject<{
                kind: z.ZodEnum<["files", "screenshot", "validation", "note"]>;
                detail: z.ZodString;
            }, "strip", z.ZodTypeAny, {
                kind: "validation" | "files" | "screenshot" | "note";
                detail: string;
            }, {
                kind: "validation" | "files" | "screenshot" | "note";
                detail: string;
            }>, "many">;
            checklistResults: z.ZodOptional<z.ZodArray<z.ZodObject<{
                itemId: z.ZodString;
                done: z.ZodBoolean;
            }, "strip", z.ZodTypeAny, {
                itemId: string;
                done: boolean;
            }, {
                itemId: string;
                done: boolean;
            }>, "many">>;
        }, "strip", z.ZodTypeAny, {
            verb: string;
            summary: string;
            stepId: string;
            iteration: number;
            reportId: string;
            evidence: {
                kind: "validation" | "files" | "screenshot" | "note";
                detail: string;
            }[];
            checklistResults?: {
                itemId: string;
                done: boolean;
            }[] | undefined;
        }, {
            verb: string;
            summary: string;
            stepId: string;
            iteration: number;
            reportId: string;
            evidence: {
                kind: "validation" | "files" | "screenshot" | "note";
                detail: string;
            }[];
            checklistResults?: {
                itemId: string;
                done: boolean;
            }[] | undefined;
        }>>;
        all: z.ZodOptional<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        operation: "start" | "status" | "advance" | "list";
        all?: boolean | undefined;
        projectPath?: string | undefined;
        laneId?: string | undefined;
        target?: string | undefined;
        renderUrl?: string | undefined;
        startRequestId?: string | undefined;
        checkpointId?: string | undefined;
        action?: "stop" | "complete" | "retry" | "skip" | "resume" | "interrupt" | undefined;
        expectedRevision?: number | undefined;
        reason?: string | undefined;
        report?: {
            verb: string;
            summary: string;
            stepId: string;
            iteration: number;
            reportId: string;
            evidence: {
                kind: "validation" | "files" | "screenshot" | "note";
                detail: string;
            }[];
            checklistResults?: {
                itemId: string;
                done: boolean;
            }[] | undefined;
        } | undefined;
    }, {
        operation: "start" | "status" | "advance" | "list";
        all?: boolean | undefined;
        projectPath?: string | undefined;
        laneId?: string | undefined;
        target?: string | undefined;
        renderUrl?: string | undefined;
        startRequestId?: string | undefined;
        checkpointId?: string | undefined;
        action?: "stop" | "complete" | "retry" | "skip" | "resume" | "interrupt" | undefined;
        expectedRevision?: number | undefined;
        reason?: string | undefined;
        report?: {
            verb: string;
            summary: string;
            stepId: string;
            iteration: number;
            reportId: string;
            evidence: {
                kind: "validation" | "files" | "screenshot" | "note";
                detail: string;
            }[];
            checklistResults?: {
                itemId: string;
                done: boolean;
            }[] | undefined;
        } | undefined;
    }>, {
        operation: "start" | "status" | "advance" | "list";
        all?: boolean | undefined;
        projectPath?: string | undefined;
        laneId?: string | undefined;
        target?: string | undefined;
        renderUrl?: string | undefined;
        startRequestId?: string | undefined;
        checkpointId?: string | undefined;
        action?: "stop" | "complete" | "retry" | "skip" | "resume" | "interrupt" | undefined;
        expectedRevision?: number | undefined;
        reason?: string | undefined;
        report?: {
            verb: string;
            summary: string;
            stepId: string;
            iteration: number;
            reportId: string;
            evidence: {
                kind: "validation" | "files" | "screenshot" | "note";
                detail: string;
            }[];
            checklistResults?: {
                itemId: string;
                done: boolean;
            }[] | undefined;
        } | undefined;
    }, {
        operation: "start" | "status" | "advance" | "list";
        all?: boolean | undefined;
        projectPath?: string | undefined;
        laneId?: string | undefined;
        target?: string | undefined;
        renderUrl?: string | undefined;
        startRequestId?: string | undefined;
        checkpointId?: string | undefined;
        action?: "stop" | "complete" | "retry" | "skip" | "resume" | "interrupt" | undefined;
        expectedRevision?: number | undefined;
        reason?: string | undefined;
        report?: {
            verb: string;
            summary: string;
            stepId: string;
            iteration: number;
            reportId: string;
            evidence: {
                kind: "validation" | "files" | "screenshot" | "note";
                detail: string;
            }[];
            checklistResults?: {
                itemId: string;
                done: boolean;
            }[] | undefined;
        } | undefined;
    }>, {
        operation: "start" | "status" | "advance" | "list";
        all?: boolean | undefined;
        projectPath?: string | undefined;
        laneId?: string | undefined;
        target?: string | undefined;
        renderUrl?: string | undefined;
        startRequestId?: string | undefined;
        checkpointId?: string | undefined;
        action?: "stop" | "complete" | "retry" | "skip" | "resume" | "interrupt" | undefined;
        expectedRevision?: number | undefined;
        reason?: string | undefined;
        report?: {
            verb: string;
            summary: string;
            stepId: string;
            iteration: number;
            reportId: string;
            evidence: {
                kind: "validation" | "files" | "screenshot" | "note";
                detail: string;
            }[];
            checklistResults?: {
                itemId: string;
                done: boolean;
            }[] | undefined;
        } | undefined;
    }, {
        operation: "start" | "status" | "advance" | "list";
        all?: boolean | undefined;
        projectPath?: string | undefined;
        laneId?: string | undefined;
        target?: string | undefined;
        renderUrl?: string | undefined;
        startRequestId?: string | undefined;
        checkpointId?: string | undefined;
        action?: "stop" | "complete" | "retry" | "skip" | "resume" | "interrupt" | undefined;
        expectedRevision?: number | undefined;
        reason?: string | undefined;
        report?: {
            verb: string;
            summary: string;
            stepId: string;
            iteration: number;
            reportId: string;
            evidence: {
                kind: "validation" | "files" | "screenshot" | "note";
                detail: string;
            }[];
            checklistResults?: {
                itemId: string;
                done: boolean;
            }[] | undefined;
        } | undefined;
    }>, {
        operation: "start" | "status" | "advance" | "list";
        all?: boolean | undefined;
        projectPath?: string | undefined;
        laneId?: string | undefined;
        target?: string | undefined;
        renderUrl?: string | undefined;
        startRequestId?: string | undefined;
        checkpointId?: string | undefined;
        action?: "stop" | "complete" | "retry" | "skip" | "resume" | "interrupt" | undefined;
        expectedRevision?: number | undefined;
        reason?: string | undefined;
        report?: {
            verb: string;
            summary: string;
            stepId: string;
            iteration: number;
            reportId: string;
            evidence: {
                kind: "validation" | "files" | "screenshot" | "note";
                detail: string;
            }[];
            checklistResults?: {
                itemId: string;
                done: boolean;
            }[] | undefined;
        } | undefined;
    }, {
        operation: "start" | "status" | "advance" | "list";
        all?: boolean | undefined;
        projectPath?: string | undefined;
        laneId?: string | undefined;
        target?: string | undefined;
        renderUrl?: string | undefined;
        startRequestId?: string | undefined;
        checkpointId?: string | undefined;
        action?: "stop" | "complete" | "retry" | "skip" | "resume" | "interrupt" | undefined;
        expectedRevision?: number | undefined;
        reason?: string | undefined;
        report?: {
            verb: string;
            summary: string;
            stepId: string;
            iteration: number;
            reportId: string;
            evidence: {
                kind: "validation" | "files" | "screenshot" | "note";
                detail: string;
            }[];
            checklistResults?: {
                itemId: string;
                done: boolean;
            }[] | undefined;
        } | undefined;
    }>, {
        operation: "start" | "status" | "advance" | "list";
        all?: boolean | undefined;
        projectPath?: string | undefined;
        laneId?: string | undefined;
        target?: string | undefined;
        renderUrl?: string | undefined;
        startRequestId?: string | undefined;
        checkpointId?: string | undefined;
        action?: "stop" | "complete" | "retry" | "skip" | "resume" | "interrupt" | undefined;
        expectedRevision?: number | undefined;
        reason?: string | undefined;
        report?: {
            verb: string;
            summary: string;
            stepId: string;
            iteration: number;
            reportId: string;
            evidence: {
                kind: "validation" | "files" | "screenshot" | "note";
                detail: string;
            }[];
            checklistResults?: {
                itemId: string;
                done: boolean;
            }[] | undefined;
        } | undefined;
    }, {
        operation: "start" | "status" | "advance" | "list";
        all?: boolean | undefined;
        projectPath?: string | undefined;
        laneId?: string | undefined;
        target?: string | undefined;
        renderUrl?: string | undefined;
        startRequestId?: string | undefined;
        checkpointId?: string | undefined;
        action?: "stop" | "complete" | "retry" | "skip" | "resume" | "interrupt" | undefined;
        expectedRevision?: number | undefined;
        reason?: string | undefined;
        report?: {
            verb: string;
            summary: string;
            stepId: string;
            iteration: number;
            reportId: string;
            evidence: {
                kind: "validation" | "files" | "screenshot" | "note";
                detail: string;
            }[];
            checklistResults?: {
                itemId: string;
                done: boolean;
            }[] | undefined;
        } | undefined;
    }>, {
        operation: "start" | "status" | "advance" | "list";
        all?: boolean | undefined;
        projectPath?: string | undefined;
        laneId?: string | undefined;
        target?: string | undefined;
        renderUrl?: string | undefined;
        startRequestId?: string | undefined;
        checkpointId?: string | undefined;
        action?: "stop" | "complete" | "retry" | "skip" | "resume" | "interrupt" | undefined;
        expectedRevision?: number | undefined;
        reason?: string | undefined;
        report?: {
            verb: string;
            summary: string;
            stepId: string;
            iteration: number;
            reportId: string;
            evidence: {
                kind: "validation" | "files" | "screenshot" | "note";
                detail: string;
            }[];
            checklistResults?: {
                itemId: string;
                done: boolean;
            }[] | undefined;
        } | undefined;
    }, {
        operation: "start" | "status" | "advance" | "list";
        all?: boolean | undefined;
        projectPath?: string | undefined;
        laneId?: string | undefined;
        target?: string | undefined;
        renderUrl?: string | undefined;
        startRequestId?: string | undefined;
        checkpointId?: string | undefined;
        action?: "stop" | "complete" | "retry" | "skip" | "resume" | "interrupt" | undefined;
        expectedRevision?: number | undefined;
        reason?: string | undefined;
        report?: {
            verb: string;
            summary: string;
            stepId: string;
            iteration: number;
            reportId: string;
            evidence: {
                kind: "validation" | "files" | "screenshot" | "note";
                detail: string;
            }[];
            checklistResults?: {
                itemId: string;
                done: boolean;
            }[] | undefined;
        } | undefined;
    }>;
    readonly sidecoach_list_flows: z.ZodObject<{
        tier: z.ZodOptional<z.ZodNumber>;
        idPrefix: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        tier?: number | undefined;
        idPrefix?: string | undefined;
    }, {
        tier?: number | undefined;
        idPrefix?: string | undefined;
    }>;
    readonly sidecoach_validate_polish_standard: z.ZodEffects<z.ZodObject<{
        html: z.ZodOptional<z.ZodString>;
        css: z.ZodOptional<z.ZodString>;
        designTokens: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
        contextOverrides: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    }, "strip", z.ZodTypeAny, {
        html?: string | undefined;
        css?: string | undefined;
        designTokens?: Record<string, unknown> | undefined;
        contextOverrides?: Record<string, unknown> | undefined;
    }, {
        html?: string | undefined;
        css?: string | undefined;
        designTokens?: Record<string, unknown> | undefined;
        contextOverrides?: Record<string, unknown> | undefined;
    }>, {
        html?: string | undefined;
        css?: string | undefined;
        designTokens?: Record<string, unknown> | undefined;
        contextOverrides?: Record<string, unknown> | undefined;
    }, {
        html?: string | undefined;
        css?: string | undefined;
        designTokens?: Record<string, unknown> | undefined;
        contextOverrides?: Record<string, unknown> | undefined;
    }>;
    readonly sidecoach_validate_extended_domain: z.ZodObject<{
        html: z.ZodOptional<z.ZodString>;
        css: z.ZodOptional<z.ZodString>;
        designTokens: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
        typography: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
        colors: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
        spacing: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
        motion: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
        accessibility: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
        contrast: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
        performance: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
        visualization: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
        internationalization: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    }, "strip", z.ZodTypeAny, {
        html?: string | undefined;
        css?: string | undefined;
        designTokens?: Record<string, unknown> | undefined;
        typography?: Record<string, unknown> | undefined;
        colors?: Record<string, unknown> | undefined;
        spacing?: Record<string, unknown> | undefined;
        motion?: Record<string, unknown> | undefined;
        accessibility?: Record<string, unknown> | undefined;
        contrast?: Record<string, unknown> | undefined;
        performance?: Record<string, unknown> | undefined;
        visualization?: Record<string, unknown> | undefined;
        internationalization?: Record<string, unknown> | undefined;
    }, {
        html?: string | undefined;
        css?: string | undefined;
        designTokens?: Record<string, unknown> | undefined;
        typography?: Record<string, unknown> | undefined;
        colors?: Record<string, unknown> | undefined;
        spacing?: Record<string, unknown> | undefined;
        motion?: Record<string, unknown> | undefined;
        accessibility?: Record<string, unknown> | undefined;
        contrast?: Record<string, unknown> | undefined;
        performance?: Record<string, unknown> | undefined;
        visualization?: Record<string, unknown> | undefined;
        internationalization?: Record<string, unknown> | undefined;
    }>;
    readonly sidecoach_validate_taste: z.ZodObject<{
        html: z.ZodString;
        css: z.ZodOptional<z.ZodString>;
        iconLibrary: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        html: string;
        css?: string | undefined;
        iconLibrary?: string | undefined;
    }, {
        html: string;
        css?: string | undefined;
        iconLibrary?: string | undefined;
    }>;
    readonly sidecoach_get_cost_ledger: z.ZodObject<{
        format: z.ZodOptional<z.ZodEnum<["raw", "summary"]>>;
    }, "strip", z.ZodTypeAny, {
        format?: "raw" | "summary" | undefined;
    }, {
        format?: "raw" | "summary" | undefined;
    }>;
    readonly sidecoach_get_cheatsheet: z.ZodObject<{
        section: z.ZodOptional<z.ZodEnum<["lanes", "verbs", "flows", "routing", "all"]>>;
    }, "strip", z.ZodTypeAny, {
        section?: "verbs" | "lanes" | "flows" | "routing" | "all" | undefined;
    }, {
        section?: "verbs" | "lanes" | "flows" | "routing" | "all" | undefined;
    }>;
    readonly sidecoach_get_flow_metadata: z.ZodObject<{
        flowId: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        flowId: string;
    }, {
        flowId: string;
    }>;
    readonly sidecoach_state_set: z.ZodObject<{
        key: z.ZodString;
        value: z.ZodString;
        ttlMs: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        value: string;
        key: string;
        ttlMs?: number | undefined;
    }, {
        value: string;
        key: string;
        ttlMs?: number | undefined;
    }>;
    readonly sidecoach_state_get: z.ZodObject<{
        key: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        key: string;
    }, {
        key: string;
    }>;
    readonly sidecoach_state_delete: z.ZodObject<{
        key: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        key: string;
    }, {
        key: string;
    }>;
    readonly sidecoach_state_list_keys: z.ZodObject<{
        prefix: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        prefix?: string | undefined;
    }, {
        prefix?: string | undefined;
    }>;
    readonly sidecoach_ast_grep: z.ZodObject<{
        pattern: z.ZodString;
        language: z.ZodOptional<z.ZodEnum<["javascript", "typescript", "tsx", "python", "go", "rust", "java", "c", "cpp", "html", "css", "json", "yaml"]>>;
        path: z.ZodOptional<z.ZodString>;
        maxResults: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        pattern: string;
        language?: "html" | "css" | "javascript" | "typescript" | "tsx" | "python" | "go" | "rust" | "java" | "c" | "cpp" | "json" | "yaml" | undefined;
        path?: string | undefined;
        maxResults?: number | undefined;
    }, {
        pattern: string;
        language?: "html" | "css" | "javascript" | "typescript" | "tsx" | "python" | "go" | "rust" | "java" | "c" | "cpp" | "json" | "yaml" | undefined;
        path?: string | undefined;
        maxResults?: number | undefined;
    }>;
    readonly sidecoach_lsp_hover: z.ZodObject<{
        file: z.ZodString;
        line: z.ZodNumber;
        character: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        file: string;
        line: number;
        character: number;
    }, {
        file: string;
        line: number;
        character: number;
    }>;
    readonly sidecoach_lsp_goto_definition: z.ZodObject<{
        file: z.ZodString;
        line: z.ZodNumber;
        character: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        file: string;
        line: number;
        character: number;
    }, {
        file: string;
        line: number;
        character: number;
    }>;
    readonly sidecoach_lsp_find_references: z.ZodObject<{
        file: z.ZodString;
        line: z.ZodNumber;
        character: z.ZodNumber;
        includeDeclaration: z.ZodOptional<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        file: string;
        line: number;
        character: number;
        includeDeclaration?: boolean | undefined;
    }, {
        file: string;
        line: number;
        character: number;
        includeDeclaration?: boolean | undefined;
    }>;
    readonly sidecoach_lsp_document_symbols: z.ZodObject<{
        file: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        file: string;
    }, {
        file: string;
    }>;
    readonly sidecoach_lsp_workspace_symbols: z.ZodObject<{
        query: z.ZodString;
        language: z.ZodOptional<z.ZodEnum<["typescript", "javascript", "go", "rust", "python", "c", "cpp"]>>;
        file: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        query: string;
        file?: string | undefined;
        language?: "javascript" | "typescript" | "python" | "go" | "rust" | "c" | "cpp" | undefined;
    }, {
        query: string;
        file?: string | undefined;
        language?: "javascript" | "typescript" | "python" | "go" | "rust" | "c" | "cpp" | undefined;
    }>;
    readonly sidecoach_python_repl_execute: z.ZodObject<{
        code: z.ZodString;
        timeoutMs: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        code: string;
        timeoutMs?: number | undefined;
    }, {
        code: string;
        timeoutMs?: number | undefined;
    }>;
};
export type ToolName = keyof typeof TOOL_INPUT_SCHEMAS;
//# sourceMappingURL=schemas.d.ts.map