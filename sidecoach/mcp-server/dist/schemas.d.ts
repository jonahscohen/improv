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
export declare const listModesShape: {};
export declare const ListModesInput: z.ZodObject<{}, "strip", z.ZodTypeAny, {}, {}>;
export type ListModesInputT = z.infer<typeof ListModesInput>;
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
export declare const resolveKeywordShape: {
    phrase: z.ZodString;
};
export declare const ResolveKeywordInput: z.ZodObject<{
    phrase: z.ZodString;
}, "strip", z.ZodTypeAny, {
    phrase: string;
}, {
    phrase: string;
}>;
export type ResolveKeywordInputT = z.infer<typeof ResolveKeywordInput>;
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
    section: z.ZodOptional<z.ZodEnum<["modes", "verbs", "flows", "routing", "all"]>>;
};
export declare const GetCheatsheetInput: z.ZodObject<{
    section: z.ZodOptional<z.ZodEnum<["modes", "verbs", "flows", "routing", "all"]>>;
}, "strip", z.ZodTypeAny, {
    section?: "verbs" | "modes" | "flows" | "routing" | "all" | undefined;
}, {
    section?: "verbs" | "modes" | "flows" | "routing" | "all" | undefined;
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
export declare const TOOL_INPUT_SCHEMAS: {
    readonly sidecoach_list_verbs: z.ZodObject<{
        phase: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        phase?: string | undefined;
    }, {
        phase?: string | undefined;
    }>;
    readonly sidecoach_list_modes: z.ZodObject<{}, "strip", z.ZodTypeAny, {}, {}>;
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
    readonly sidecoach_resolve_keyword: z.ZodObject<{
        phrase: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        phrase: string;
    }, {
        phrase: string;
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
        section: z.ZodOptional<z.ZodEnum<["modes", "verbs", "flows", "routing", "all"]>>;
    }, "strip", z.ZodTypeAny, {
        section?: "verbs" | "modes" | "flows" | "routing" | "all" | undefined;
    }, {
        section?: "verbs" | "modes" | "flows" | "routing" | "all" | undefined;
    }>;
    readonly sidecoach_get_flow_metadata: z.ZodObject<{
        flowId: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        flowId: string;
    }, {
        flowId: string;
    }>;
};
export type ToolName = keyof typeof TOOL_INPUT_SCHEMAS;
//# sourceMappingURL=schemas.d.ts.map