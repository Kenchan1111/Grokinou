import React from "react";
interface ModelOption {
    model: string;
}
interface ModelSelectionProps {
    models: ModelOption[];
    selectedIndex: number;
    isVisible: boolean;
    currentModel: string;
}
export declare const ModelSelection: React.NamedExoticComponent<ModelSelectionProps>;
export {};
