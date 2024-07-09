/*
* This algorithm was created for use on CAN Bus Debugger devices but is also available in JS form. For more
* information on this algorithm please see https://www.canbusdebugger.com/can-bit-timing-calculator
*
* The BOSCH CiA99 paper is also worth reading: http://www.oertel-halle.de/files/cia99paper.pdf
*
* This file is still a work in progress and will be tidied up over time.
*
* Author: Ben Evans <ben@canbusdebugger.com>
* License: MPL-2.0
*
* If including on your website or other medium, please consider linking back to https://www.canbusdebugger.com
*/

const SYNC_SEG = 1;

/**
 * Finds the best CAN nominal bit timing solution for a desired baud rate and sample point, given a devices capability.
 *
 * @param deviceCapability The device capability as a dictionary
 * @param desiredBaud The desired baud rate
 * @param desiredSamplePoint The desired sample point
 * @returns The solution as a dictionary
 */
function find_best_can_timing_solution(deviceCapability, desiredBaud, desiredSamplePoint) {
    var result = {solutionFound: false, baudRate: 0, baudError: Number.MAX_VALUE, samplePoint: 0, samplePointError: 100, oscillatorTolerance: 0, prescaler: 0, propSeg: 0, maxSJW: 0};

    minTQ = Math.max((SYNC_SEG + deviceCapability.minTSeg1 + deviceCapability.minTSeg2), deviceCapability.minTQ);
    maxTQ = Math.min((SYNC_SEG + deviceCapability.maxTSeg1 + deviceCapability.maxTSeg2), deviceCapability.maxTQ);
    // Loop through all possible prescalers
    for (var prescaler = deviceCapability.maxPS; prescaler >= deviceCapability.minPS; prescaler--) {
        // Calculate the number of time quanta needed to roughly capture the desired baud rate
        var timeQuanta = Math.round((deviceCapability.clock / prescaler) / desiredBaud);
        if ((timeQuanta >= minTQ) && (timeQuanta <= maxTQ)) {
            // This is a possible solution
            var calculatedBaud = deviceCapability.clock / (prescaler * timeQuanta);
            var baudError = Math.abs(calculatedBaud - desiredBaud);
            var maxPropSeg = Math.min(deviceCapability.maxPropSeg, (timeQuanta - (SYNC_SEG + (deviceCapability.minTSeg1 - deviceCapability.minPropSeg) + deviceCapability.minTSeg2)));
            // Now loop through all possible propagation segment values
            for (var propSeg = deviceCapability.minPropSeg; propSeg <= maxPropSeg; propSeg++) {
                var remainingTimeQuanta = timeQuanta - (SYNC_SEG + propSeg);
                // Split the remaining time quanta evenly over the phase segments
                var phaseSeg1 = 0;
                var phaseSeg2 = 0;
                if (remainingTimeQuanta % 2 === 0) {
                    phaseSeg1 = remainingTimeQuanta / 2;
                    phaseSeg2 = remainingTimeQuanta / 2;
                } else {
                    // If remaining time quanta is odd, round phase seg 1 down and phase seg 2 up
                    phaseSeg1 = Math.floor(remainingTimeQuanta / 2);
                    phaseSeg2 = phaseSeg1 + 1;
                }
                console.assert((SYNC_SEG + propSeg + phaseSeg1 + phaseSeg2) === timeQuanta, "Segments do not add to total TQ");
                // Ensure seg1 and seg2 are within range here
                if ((propSeg + phaseSeg1 > deviceCapability.maxTSeg1) || (propSeg + phaseSeg1 < deviceCapability.minTSeg1)) {
                    continue;
                }
                if ((phaseSeg2 > deviceCapability.maxTSeg2) || (phaseSeg2 < deviceCapability.minTSeg2)) {
                    continue;
                }
                // Calc max SJW
                var maxSJW = Math.min(phaseSeg1, phaseSeg2, deviceCapability.maxSJW);
                // Calc oscillator tolerance
                var df1 = Math.min(phaseSeg1, phaseSeg2) / (2 * ((13 * timeQuanta) - phaseSeg2));
                var df2 = maxSJW / (20 * timeQuanta);
                var oscillatorTolerance = Math.min(df1, df2);
                if (oscillatorTolerance < 0) {
                    // Not a valid solution
                    continue;
                }
                // Calculate sample point and sample point error
                var calculatedSamplePoint = ((SYNC_SEG + propSeg + phaseSeg1) / timeQuanta) * 100.0;
                var samplePointError = Math.abs(desiredSamplePoint - calculatedSamplePoint);
                // Preference order: lowest baud error, lowest sample point error, largest osc tolerance, lower prescaler (more tq)
                if ((baudError < result.baudError) ||
                        ((baudError <= result.baudError) && (samplePointError < result.samplePointError)) ||
                        ((baudError <= result.baudError) && (samplePointError <= result.samplePointError) && (oscillatorTolerance > result.oscillatorTolerance)) ||
                        ((baudError <= result.baudError) && (samplePointError <= result.samplePointError) && (oscillatorTolerance >= result.oscillatorTolerance) && (result.prescaler != prescaler))) {
                    // This is the current best solution - populate the result
                    result.solutionFound = true;
                    result.baudRate = calculatedBaud;
                    result.baudError = baudError;
                    result.samplePoint = calculatedSamplePoint;
                    result.samplePointError = samplePointError;
                    result.oscillatorTolerance = oscillatorTolerance;
                    result.prescaler = prescaler;
                    result.propSeg = propSeg;
                    result.pseg1 = phaseSeg1;
                    result.pseg2 = phaseSeg2;
                    result.maxSJW = maxSJW;
                }
            }
        }
    }
    return result;
}

// Example usage - check for sane inputs if accepting user input
var capability = {};
capability.clock = 80000000;
capability.minPS = 1;
capability.maxPS = 512;
capability.minTQ = 4;
capability.maxTQ = 385;
capability.minPropSeg = 1;
capability.maxPropSeg = capability.maxTQ - (SYNC_SEG + (1 + 1));
capability.minTSeg1 = 2;
capability.maxTSeg1 = 256;
capability.minTSeg2 = 1;
capability.maxTSeg2 = 128;
capability.minSJW = 1;
capability.maxSJW = 128;

var result = find_best_can_timing_solution(capability, 500000, 87.5);
console.log(result);