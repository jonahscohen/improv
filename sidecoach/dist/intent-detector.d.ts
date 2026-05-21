import { MatchResult, DisambiguationResult } from './types';
export declare class IntentDetector {
    private detectors;
    constructor();
    detect(utterance: string): MatchResult | DisambiguationResult;
    private has;
    private hasAny;
    private hasNone;
    private createFlow1Detector;
    private createFlow2Detector;
    private createFlow3Detector;
    private createFlow4Detector;
    private createFlow5Detector;
    private createFlow6Detector;
    private createFlow7Detector;
    private createFlow8Detector;
    private createFlow9Detector;
    private createFlow10Detector;
    private createFlow11Detector;
    private createFlow12Detector;
    private createFlow13Detector;
    private createFlow14Detector;
}
export declare function createDetector(): IntentDetector;
//# sourceMappingURL=intent-detector.d.ts.map