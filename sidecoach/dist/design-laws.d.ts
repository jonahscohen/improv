import { Register } from './project-context';
export declare const ANTI_PATTERNS: {
    side_stripe_borders: {
        id: string;
        name: string;
        description: string;
        severity: string;
        checker: (code: string) => boolean;
    };
    gradient_text: {
        id: string;
        name: string;
        description: string;
        severity: string;
        checker: (code: string) => boolean;
    };
    glassmorphism_default: {
        id: string;
        name: string;
        description: string;
        severity: string;
        checker: (code: string) => boolean;
    };
    hero_metric_template: {
        id: string;
        name: string;
        description: string;
        severity: string;
        checker: (code: string) => boolean;
    };
    identical_card_grids: {
        id: string;
        name: string;
        description: string;
        severity: string;
        checker: (code: string) => boolean;
    };
    modal_as_first_thought: {
        id: string;
        name: string;
        description: string;
        severity: string;
        checker: (code: string) => boolean;
    };
    flat_scales: {
        id: string;
        name: string;
        description: string;
        severity: string;
        checker: (code: string) => boolean;
    };
    body_too_wide: {
        id: string;
        name: string;
        description: string;
        severity: string;
        checker: (code: string) => boolean;
    };
    pure_black_white: {
        id: string;
        name: string;
        description: string;
        severity: string;
        checker: (code: string) => boolean;
    };
    alpha_abuse: {
        id: string;
        name: string;
        description: string;
        severity: string;
        checker: (code: string) => boolean;
    };
    missing_wcag_contrast: {
        id: string;
        name: string;
        description: string;
        severity: string;
        checker: (code: string) => boolean;
    };
    inconsistent_spacing: {
        id: string;
        name: string;
        description: string;
        severity: string;
        checker: (code: string) => boolean;
    };
    nested_cards: {
        id: string;
        name: string;
        description: string;
        severity: string;
        checker: (code: string) => boolean;
    };
    animated_layout_properties: {
        id: string;
        name: string;
        description: string;
        severity: string;
        checker: (code: string) => boolean;
    };
    bounce_elastic_easing: {
        id: string;
        name: string;
        description: string;
        severity: string;
        checker: (code: string) => boolean;
    };
    excessive_motion: {
        id: string;
        name: string;
        description: string;
        severity: string;
        checker: (code: string) => boolean;
    };
    missing_focus_state: {
        id: string;
        name: string;
        description: string;
        severity: string;
        checker: (code: string) => boolean;
    };
    placeholder_as_label: {
        id: string;
        name: string;
        description: string;
        severity: string;
        checker: (code: string) => boolean;
    };
    no_error_messages: {
        id: string;
        name: string;
        description: string;
        severity: string;
        checker: (code: string) => boolean;
    };
    redundant_copy: {
        id: string;
        name: string;
        description: string;
        severity: string;
        checker: (code: string) => boolean;
    };
    no_word_earns_place: {
        id: string;
        name: string;
        description: string;
        severity: string;
        checker: (code: string) => boolean;
    };
    desktop_first: {
        id: string;
        name: string;
        description: string;
        severity: string;
        checker: (code: string) => boolean;
    };
    touch_targets_small: {
        id: string;
        name: string;
        description: string;
        severity: string;
        checker: (code: string) => boolean;
    };
    tinted_images: {
        id: string;
        name: string;
        description: string;
        severity: string;
        checker: (code: string) => boolean;
    };
    generic_component_names: {
        id: string;
        name: string;
        description: string;
        severity: string;
        checker: (code: string) => boolean;
    };
    will_change_abuse: {
        id: string;
        name: string;
        description: string;
        severity: string;
        checker: (code: string) => boolean;
    };
    transition_all: {
        id: string;
        name: string;
        description: string;
        severity: string;
        checker: (code: string) => boolean;
    };
};
export declare const SHARED_DESIGN_LAWS: {
    color: {
        domain: string;
        rules: string[];
    };
    typography: {
        domain: string;
        rules: string[];
    };
    spatial: {
        domain: string;
        rules: string[];
    };
    motion: {
        domain: string;
        rules: string[];
    };
    interaction: {
        domain: string;
        rules: string[];
    };
    responsive: {
        domain: string;
        rules: string[];
    };
    writing: {
        domain: string;
        rules: string[];
    };
};
export declare const CATEGORY_REFLEX: {
    first_order: {
        question: string;
        examples: {
            observability: string;
            fintech: string;
            ecommerce: string;
            healthcare: string;
            ai_workflows: string;
            crypto: string;
            productivity: string;
        };
    };
    second_order: {
        question: string;
        examples: {
            'observability without dark blues': string;
            'fintech avoiding green': string;
            'ecommerce without red': string;
            'AI workflow tool that is not SaaS-cream': string;
            'productivity tool that is not Linear': string;
        };
    };
    oversaturated_families: string[];
};
export declare const REGISTER_SPECIFIC_LAWS: {
    brand: {
        register: string;
        description: string;
        color_strategy: string;
        typography_personality: string;
        component_approach: string;
        motion_intensity: string;
        tone: string;
        validation_focus: string;
    };
    product: {
        register: string;
        description: string;
        color_strategy: string;
        typography_personality: string;
        component_approach: string;
        motion_intensity: string;
        tone: string;
        validation_focus: string;
    };
};
export declare const CRITIQUE_RULES: {
    id: string;
    name: string;
    description: string;
    weight: number;
}[];
export declare function getAntiPatternById(id: string): {
    id: string;
    name: string;
    description: string;
    severity: string;
    checker: (code: string) => boolean;
} | {
    id: string;
    name: string;
    description: string;
    severity: string;
    checker: (code: string) => boolean;
} | {
    id: string;
    name: string;
    description: string;
    severity: string;
    checker: (code: string) => boolean;
} | {
    id: string;
    name: string;
    description: string;
    severity: string;
    checker: (code: string) => boolean;
} | {
    id: string;
    name: string;
    description: string;
    severity: string;
    checker: (code: string) => boolean;
} | {
    id: string;
    name: string;
    description: string;
    severity: string;
    checker: (code: string) => boolean;
} | {
    id: string;
    name: string;
    description: string;
    severity: string;
    checker: (code: string) => boolean;
} | {
    id: string;
    name: string;
    description: string;
    severity: string;
    checker: (code: string) => boolean;
} | {
    id: string;
    name: string;
    description: string;
    severity: string;
    checker: (code: string) => boolean;
} | {
    id: string;
    name: string;
    description: string;
    severity: string;
    checker: (code: string) => boolean;
} | {
    id: string;
    name: string;
    description: string;
    severity: string;
    checker: (code: string) => boolean;
} | {
    id: string;
    name: string;
    description: string;
    severity: string;
    checker: (code: string) => boolean;
} | {
    id: string;
    name: string;
    description: string;
    severity: string;
    checker: (code: string) => boolean;
} | {
    id: string;
    name: string;
    description: string;
    severity: string;
    checker: (code: string) => boolean;
} | {
    id: string;
    name: string;
    description: string;
    severity: string;
    checker: (code: string) => boolean;
} | {
    id: string;
    name: string;
    description: string;
    severity: string;
    checker: (code: string) => boolean;
} | {
    id: string;
    name: string;
    description: string;
    severity: string;
    checker: (code: string) => boolean;
} | {
    id: string;
    name: string;
    description: string;
    severity: string;
    checker: (code: string) => boolean;
} | {
    id: string;
    name: string;
    description: string;
    severity: string;
    checker: (code: string) => boolean;
} | {
    id: string;
    name: string;
    description: string;
    severity: string;
    checker: (code: string) => boolean;
} | {
    id: string;
    name: string;
    description: string;
    severity: string;
    checker: (code: string) => boolean;
} | {
    id: string;
    name: string;
    description: string;
    severity: string;
    checker: (code: string) => boolean;
} | {
    id: string;
    name: string;
    description: string;
    severity: string;
    checker: (code: string) => boolean;
} | {
    id: string;
    name: string;
    description: string;
    severity: string;
    checker: (code: string) => boolean;
} | {
    id: string;
    name: string;
    description: string;
    severity: string;
    checker: (code: string) => boolean;
} | {
    id: string;
    name: string;
    description: string;
    severity: string;
    checker: (code: string) => boolean;
} | {
    id: string;
    name: string;
    description: string;
    severity: string;
    checker: (code: string) => boolean;
} | undefined;
export declare function getDesignLawsForRegister(register: Register): {
    register: string;
    description: string;
    color_strategy: string;
    typography_personality: string;
    component_approach: string;
    motion_intensity: string;
    tone: string;
    validation_focus: string;
} | {
    register: string;
    description: string;
    color_strategy: string;
    typography_personality: string;
    component_approach: string;
    motion_intensity: string;
    tone: string;
    validation_focus: string;
};
export declare function getSharedLawsForDomain(domain: string): {
    domain: string;
    rules: string[];
} | {
    domain: string;
    rules: string[];
} | {
    domain: string;
    rules: string[];
} | {
    domain: string;
    rules: string[];
} | {
    domain: string;
    rules: string[];
} | {
    domain: string;
    rules: string[];
} | {
    domain: string;
    rules: string[];
};
//# sourceMappingURL=design-laws.d.ts.map