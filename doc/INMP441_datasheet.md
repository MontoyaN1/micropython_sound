## Omnidirectional Microphone with Bottom Port and I

#### 2

## S Digital Output

### General Description

The INMP 441 is a high-performance, low power, digital-output,
omnidirectional MEMS microphone with a bottom port. The
complete INMP441 solution consists of a MEMS sensor, signal
conditioning, an analog-to-digital converter, anti-aliasing filters,
power management, and an industry-standard 24-bit I²S interface.
The I²S interface allows the INMP441 to connect directly to digital
processors, such as DSPs and microcontrollers, without the need
for an audio codec in the system.

The INMP 441 has a high SNR, making it an excellent choice for
near field applications. The INMP441 has a flat wideband
frequency response, resulting in natural sound with high
intelligibility.

The INMP441 is available in a thin 4.72 × 3.76 × 1 mm surface-
mount package. It is reflow- solder compatible with no sensitivity
degradation. The INMP441 is halide free.

_*Protected by U.S. Patents 7,449,356; 7,825,484; 7,885,423; and 7,961,897.
Other patents are pending._

### Applications

- Teleconferencing Systems
- Remote Controls
- Gaming Consoles
- Mobile Devices
- Laptops
- Tablets
- Security Systems

### Features

- Digital I²S Interface with High-Precision 24-Bit Data
- High SNR of 61 dBA
- High Sensitivity of -26 dBFS
- Flat Frequency Response from 60 Hz to 15 kHz
- Low Current Consumption of 1.4 mA
- High PSR of -75 dBFS
- Small 4.72 × 3.76 × 1 mm Surface-Mount Package
- Compatible with Sn/Pb and Pb-Free Solder Processes
- RoHS/WEEE Compliant

### Functional Block Diagram

### Ordering Information

##### PART TEMP RANGE

```
INMP441ACEZ-R0* −40°C to +85°C
INMP441ACEZ-R 7 † −40°C to +85°C
EV_INMP441 —
EV_INMP441-FX —
* – 13” Tape and Reel
```
```
† – 7” Tape and reel to be discontinued. Contact sales@invensense.com for
availability.
```
```
INMP
```
```
ADC
```
```
POWER
MANAGEMENT
```
```
SCK
SD
WS
```
```
VDDGNDGNDGND
```
```
FILTER
I^2 S
SERIAL
PORT
HARDWARE
CONTROL
```
```
L/R
CHIPEN
```
**BOTTOM** (^) **TOP**
InvenSense reserves the right to change the detail
specifications as may be required to permit improvements
in the design of its products.
**InvenSense Inc.**
1745 Technology Drive, San Jose, CA 95110 U.S.A
+1(408) 988– 7339
[http://www.invensense.com](http://www.invensense.com)
Document Number: DS-INMP441-
Revision: 1.
Rev Date: 05/21/


## Table of Contents

## TABLE OF CONTENTS



## Specifications

### Table 1. Electrical Characteristics

(TA = −40 to 85°C, VDD = 1.8 to 3.3 V, CLK = 2.4 MHz, CLOAD = 30 pF, unless otherwise noted. All minimum and
maximum specifications are guaranteed across temperature, voltage, and clock frequency specified in Table 1, Table
2, Table 3, unless otherwise noted. Typical specifications are not guaranteed.)

##### PARAMETER CONDITIONS MIN TYP MAX UNITS NOTES

##### PERFORMANCE

Directionality Omni
Sensitivity 1 kHz, 94 dB SPL − 29 − 26 − 23 dBFS 1
Signal-to-Noise Ratio (SNR) 20 Hz to 20 kHz, A-weighted 61 dBA
Equivalent Input Noise (EIN) 20 Hz to 20 kHz, A-weighted 33 dBA SPL

Dynamic Range
Derived from EIN and
maximum acoustic input
87 dB

Frequency Response
Low frequency − 3 dB point 60 Hz
2
High frequency − 3 dB point 15 kHz
Total Harmonic Distortion (THD) 105 dB SPL 3 %

Power-Supply Rejection (PSR)

```
217 Hz, 100 mVp-p square
wave superimposed on VDD =
1.8 V
```
```
− 75 dBFS
```
Maximum Acoustic Input Peak 120 dB SPL

Noise Floor
20 Hz to 20 kHz, A-weighted,
RMS
− 87 dBFS

**POWER SUPPLY**
Supply Voltage (VDD) 1.62 3.63 V
Supply Current (IS)

##### VDD = 1.8 V

```
Normal Mode 1.4 1.6 mA
Standby 0.8 mA
Power Down 2 μA
```
##### VDD = 3.3 V

```
Normal Mode
2.2 2.5 mA
Standby 0.8 mA
Power Down 4.5 μA
```
**DIGITAL FILTER**

Group Delay

```
17.2/fS sec
```
```
fS = 48 kHz 359 μs^
fS = 16 kHz 1078 μs^
```
Pass-Band Ripple ±0.04 dB

Stop-Band Attenuation 60 dB

Pass Band 0.423 × fS 20.3 kHz
**Note 1** : The peak-to-peak amplitude relative to peak-to-peak amplitude of ( 224 − 1.) The stimulus is a 104 dB SPL sinusoid having RMS amplitude
of 3.1623 Pa. Sensitivity is relative to 1 Pa.
**Note 2:** See Figure 4 and Figure 5.

Page 4 of 21
Document Number: DS-INMP441-


### Table 2. I^2 S Digital Input/Output Characteristics

##### PARAMETER CONDITIONS MIN TYP MAX UNITS NOTES

##### DIGITAL INPUT

```
Input Voltage High (VIH) L/R, WS, SCK 0.7 x VDD VDD V 1
```
```
Input Voltage Low (VIL) L/R, WS, SCK 0 0.25 x VDD V 1
SD DIGITAL INPUT
```
```
Voltage Output Low (VOL) VDD = 1.8 V, ISINK = 0.25 mA 0.1 × VDD V^1
```
```
Voltage Output Low (VOL) VDD = 1.8 V, ISINK = 0.7 mA 0.3 × VDD V^1
Voltage Output High (VOH) VDD = 1.8 V, ISINK = 0.7 mA 0.7 × VDD^ V^1
Voltage Output High (VOH) VDD = 1.8 V, ISINK = 0.25 mA 0.9 × VDD V 1
Voltage Output Low (VOL) VDD = 3.3 V, ISINK = 0.5 mA 0.1 × VDD^ V 1
```
```
Voltage Output Low (VOL) VDD = 3.3 V, ISINK = 1.7 mA 0.3 × VDD^ V 1
Voltage Output High (VOH) VDD = 3.3 V, ISINK = 1.7 mA 0.7 × VDD^ V 1
```
```
Voltage Output High (VOH) VDD = 3.3 V, ISINK = 0.5 mA 0.9 × VDD^ V 1
```
**Note 1:** Limits based on characterization results; not production tested.

### Table 3. Serial Data Port Specifications

##### PARAMETER CONDITIONS MIN TYP MAX UNITS NOTES

```
tSCH SCK high^50 ns^
```
```
tSCL SCK low^50 ns^
```
tSCP SCK period 312 ns (^)
fSCK SCK frequency 0.5 (^) 3.2 MHz (^)
tWSS WS setup^0 ns^
tWSH WS hold^20 ns^
fWS WS frequency^ 7.8^50 kHz^

### Timing Diagram

```
Figure 1. Serial Data Port Timing
```
```
SCK
```
```
WS
```
```
SD
```
```
tSCP
tSCH
```
```
tWSS tSCL tWSH
```
Page 5 of 21
Document Number: DS-INMP441-


## Absolute Maximum Ratings

Stress above those listed as Absolute Maximum Ratings may cause permanent damage to the device. These are stress ratings only
and functional operation of the device at these conditions is not implied. Exposure to the absolute maximum ratings conditions for
extended periods may affect device reliability.

### Table 4. Absolute Maximum Ratings

##### PARAMETER RATING

```
Supply Voltage (VDD) −0.3 V to +3.6 3 V
Digital Pin Input Voltage −0.3 V to VDD + 0.3 V or 3.6 3 V, whichever is less
Sound Pressure Level 160 dB
Mechanical Shock 10,000 g
Vibration Per MIL-STD-883 Method 2007, Test Condition B
Temperature Range
Biased −40°C to +85°C
Storage − 55 °C to +150°C
```
### ESD Caution

```
ESD (electrostatic discharge) sensitive device.
Charged devices and circuit boards can
discharge without detection. Although this
product features patented or proprietary
protection circuitry, damage may occur on
devices subjected to high energy ESD.
Therefore proper ESD precautions should be
taken to avoid performance degradation or
loss of functionality.
```
Page 6 of 21
Document Number: DS-INMP441-


### Soldering Profile.........................................................................................................................................................

```
Figure 2. Recommended Soldering Profile Limits
```
### Table 5. Recommended Soldering Profile*

```
PROFILE FEATURE Sn63/Pb37 Pb-Free
Average Ramp Rate (TL to TP) 1.25°C/sec max 1.25°C/sec max
```
```
Preheat
```
```
Minimum Temperature
(TSMIN)
```
##### 100°C 100°C

```
Minimum Temperature
(TSMIN)
```
##### 150°C 20 0°C

```
Time (TSMIN to TSMAX), tS 60 sec to 75 sec 60 sec to 75 sec
Ramp-Up Rate (TSMAX to TL) 1.25°C/sec 1.25°C/sec
Time Maintained Above Liquidous (tL) 45 sec to 75 sec ~50 sec
Liquidous Temperature (TL) 183°C 217°C
```
Peak Temperature (TP) (^) 215°C +3°C/−3°C 260°C +0°C/−5°C
Time Within +5°C of Actual Peak
Temperature (tP)
20 sec to 30 sec 20 sec to 30 sec^
Ramp-Down Rate 3°C/sec max 3°C/sec^ max^
Time +25°C (t25°C) to Peak Temperature 5 min max 5 min^ max^
_*The reflow profile in Table 5 is recommended for board manufacturing with InvenSense MEMS microphones. All microphones are
also compatible with the J-STD-020 profile._
tP
tL
t25°CTO PEAK TEMPERATURE
tS
PREHEAT
CRITICAL ZONE
TLTO TP
TEMPER
ATURE
TIME
RAMP-DOWN
RAMP-UP
TSMIN
TSMAX
TP
TL
Page 7 of 21
Document Number: DS-INMP441-


## Pin Configurations And Function Descriptions

```
Figure 3. Pin Configuration
```
### Table 6. Pin Function Descriptions

##### PIN NAME FUNCTION

```
1 SCK Serial-Data Clock for I²S Interface
```
##### 2 SD

```
Serial-Data Output for I²S Interface. This pin tri-states when not actively driving the
appropriate output channel. The SD trace should have a 100 kΩ pulldown resistor to
discharge the line during the time that all microphones on the bus have tri-stated their
outputs.
```
```
3 WS Serial Data-Word Select for I²S Interface
```
##### 4 L/R

```
Left/Right Channel Select. When set low, the microphone outputs its signal in the left channel
of the I²S frame. When set high, the microphone outputs its signal in the right channel.
```
```
5 GND Ground. Connect to ground on the PCB.
```
```
6 GND Ground. Connect to ground on the PCB.
```
```
7 VDD^ Power, 1.8 V to 3.3 V. This pin should be decoupled to Pin 6 with a 0.1 μF capacitor.
```
```
8 CHIPEN Microphone Enable. When set low (ground), the microphone is disabled and put in power-
down mode. When set high (VDD), the microphone is enabled.
9 GND Ground. Connect to ground on the PCB.
```
```
L/R 4 6 GND
```
```
5
GND
```
```
WS 3 7 VDD
```
```
SD 2 8 CHIPEN
```
```
SCK 1 9 GND
BOTTOM VIEW
(Notto Scale)
```
Page 8 of 21
Document Number: DS-INMP441-


## Typical Performance Characteristics

```
Figure 4. Frequency Response Mask
Figure 5. Typical Frequency Response (Measured)
```
```
Figure 6. Power-Supply Rejection (PSR) vs. Frequency
```
```
10
```
-
    -
    -
    -
    -

```
0
```
```
2
```
```
4
```
```
6
```
```
8
```
```
50 100 10k
FREQUENCY (Hz)
```
```
SENSITIVIT
```
```
Y (dB)
```
```
1k
```
```
10
```
-
-

```
0
```
```
10 100 10k
FREQUENCY (Hz)
```
```
AMPLITUDE (dB)
```
```
1k
```
```
0
```
-
    100 10k
       FREQUENCY (Hz)

```
PSR (dB)
```
```
1k
```
-
-
-
-
-
-
-

Page 9 of 21
Document Number: DS-INMP441-


## Theory of Operation

The INMP441 is a high-performance, low-power, digital-output, omni-directional MEMS microphone with a bottom port. The
complete INMP441 solution consists of a MEMS sensor, signal conditioning, an analog-to-digital converter, anti-aliasing filters,
power management, and an industry-standard 24-bit I²S interface.

The INMP441 complies with the TIA-920 _Telecommunications Telephone Terminal Equipment Transmission Requirements for
Wideband Digital Wireline Telephones_ standard.

### Understanding Sensitivity

The casual user of digital microphones may have difficulty understanding the sensitivity specification. Unlike an analog microphone
(whose specification is easily confirmed with an oscilloscope), the digital microphone output has no obvious unit of measure.

The INMP441 has a nominal sensitivity of −26 dBFS at 1 kHz with an applied sound pressure level of 94 dB. The units are in decibels
referred to full scale. The INMP441 default full-scale peak output word is 2^23 − 1 (integer representation), and − 26 dBFS of that scale
is (2^23 − 1) × 10(−26/20) = 420,426. A pure acoustic tone at 1 kHz having a 1Pa RMS amplitude results in an output digital signal whose
peak amplitude is 420,426.

Although the industry uses a standard specification of 94 dB SPL, the INMP441 test method applies a 104 dB SPL signal. The higher
sound pressure level reduces noise and improves repeatability. The INMP441 has excellent gain linearity, and the sensitivity test
result at 94 dB is derived with very high confidence from the test data.

### Power Management

The INMP441 has three different power states: normal operation, standby mode, and power-down mode.

#### Normal Operation

The microphone becomes operational 2^18 clock cycles (85 ms with SCK at 3.072 MHz) after initial power-up. The CHIPEN pin then
controls the power modes. The part is in normal operation mode when SCK is active and the CHIPEN pin is high.

#### Standby Mode

The microphone enters standby mode when the serial-data clock SCK stops and CHIPEN is high. Normal operation resumes 2^14 clock
cycles (5 ms with SCK at 3.072 MHz) after SCK restarts.

The INMP441 should not be transitioned from standby to power-down mode, or vice versa. Standby mode is only intended to be
entered from the normal operation state.

#### Power-Down Mode

The microphone enters power-down mode when CHIPEN is low, regardless of the SCK operation. Normal mode operation resumes
217 SCK clock cycles (43 ms with SCK at 3.072 MHz) after CHIPEN returns high while SCK is active.

It always takes 2^17 clock cycles to restart the INMP441 after VDD is applied.

It is not recommended to supply active clocks (WS and SCK) to the INMP441 while there is no power supplied to VDD. Doing this
continuously turns on ESD protection diodes, which may affect long-term reliability of the microphone.

#### Startup

The microphones have zero output for the first 2^18 SCK clock cycles (85ms with SCK at 3.072 MHz) following power-up.

Page 10 of 21
Document Number: DS-INMP441-


### I²S Data Interface

The slave serial-data port’s format is I²S, 24-bit, twos complement. There must be 64 SCK cycles in each WS stereo frame, or 32 SCK
cycles per data-word. The L/R control pin determines whether the INMP441 outputs data in the left or right channel. For a stereo
application, the SD pins of the left and right INMP 441 microphones should be tied together as shown in Figure 7. The format of a
stereo I²S data stream is shown in Figure 8. Figures 9 and 10 show the formats of a mono microphone data stream for left and right
microphones, respectively.

#### Data Output Mode

The output data pin (SD) is tri-stated when it is not actively driving I²S output data. SD immediately tri-states after the LSB is output
so that another microphone can drive the common data line.

The SD trace should have a pull-down resistor to discharge the line during the time that all microphones on the bus have tri-stated
their outputs. A 100 kΩ resistor is sufficient for this, as shown in Figure 7.

#### Data Word Length

The output data word length is 24 bits per channel. The INMP441 must always have 64 clock cycles for every stereo data-word (fSCK
= 64 × fWS).

#### Data-Word Format

The default data format is I²S (two’s complement), MSB-first. In this format, the MSB of each word is delayed by one SCK cycle from
the start of each half-frame.

```
Figure 7. System Block Diagram
```
```
SCKWSSD
```
```
SYSTEM MASTER
(DSP, MICROCONTROLLER,
CODEC)
```
```
CHIPEN SCK
WS
L/R SD
```
```
VDD
```
```
LEFT
INMP
GNDGNDGND
```
```
0.1μF
```
```
FROM VOLTAGE
REGULATOR
(1.8VTO 3.3V)
```
```
SCK CHIPEN
WS
SD L/R
```
```
VDD
```
```
RIGHT
INMP
GNDGNDGND
```
```
0.1μF
```
```
100kΩ
```
```
VDD VDD
```
Page 11 of 21
Document Number: DS-INMP441-


```
Figure 8. Stereo-Output I²S Format
```
```
Figure 9. Mono-Output I²S Format Left Channel (L/R = 0)
```
```
Figure 10. Mono-Output I²S Format Right Channel (L/R = 1)
```
### Digital Microphone Sensitivity

The sensitivity of a PDM output microphone is specified in units of dBFS (decibels relative to a full-scale digital output). A 0 dBFS sine
wave is defined as a signal whose peak just touches the full-scale code of the digital word (see Figure 5). This measurement
convention means that signals with a different crest factor may have an RMS level higher than 0dBFS. For example, a full-scale
square wave has an RMS level of 3dBFS.

```
Figure 11. 1 kHz, 0 dBFS Sine Wave
```
The definition of a 0 dBFS signal must be understood when measuring the sensitivity of the INMP441. An acoustic input signal of a
1 kHz sine wave at 94 dB SPL applied to the INMP441 results in an output signal with a −26 dBFS level. This means that the output
digital word peaks at −26 dB below the digital full-scale level. A common misunderstanding is that the output has an RMS level of
−29 dBFS; however, this is not the case because of the definition of a 0 dBFS sine wave.

```
MSB LSB
LEFT CHANNEL
```
```
MSB LSB
HIGH-Z HIGH-Z RIGHT CHANNEL HIGH-Z
```
```
WS^1234242526323334353656575864
```
SCK (64 ×fS)

```
SD (24-BIT)
```
```
MSB LSB
HIGH-Z LEFT CHANNEL HIGH-Z
```
```
WS 1 2 3 4 24 25 26 32 33 34 35 36 56 57 58 64
```
```
SCK (64 ×fS)
SD (24-BIT)
```
```
MSB LSB
HIGH-Z RIGHT CHANNEL HIGH-Z
```
```
WS^1234242526323334353656575864
SCK (64 ×fS)
```
```
SD (24-BIT)
```
```
1.
```
```
–1.
```
```
–0.
```
```
–0.
```
```
–0.
```
```
–0.
```
```
0
```
```
0.
```
```
0.
```
```
0.
```
```
0.
```
```
0 0.1 0.2 0.3 0.4 0.5 0.6 0.7 0.8 0.9 1.
```
```
DIGITAL AMPLITUDE (D)
```
```
TIME (ms)
```
Page 12 of 21
Document Number: DS-INMP441-


There is no commonly accepted unit of measurement to express the instantaneous level of a digital signal output from the
microphone, as opposed to the RMS level of the signal. Some measurement systems express the instantaneous level of an individual
sample in units of D, where 1.0 D is digital full scale (see Figure 11). In this case, a −26 dBFS sine wave has peaks at 0.05 D.

For more information about digital microphone sensitivity, see the AN-1112 Application Note, _Microphone Specifications Explained_.

### Synchronizing Microphones

Stereo INMP441 microphones are synchronized by the WS signal, so audio captured from two microphones sharing the same clock
will be in sync. If the mics are enabled separately, this synchronization may take up to 0.35 ms after the enable signal is asserted
while internal data paths are flushed.

### Digital Filter Characteristics

The INMP441 has an internal digital band-pass filter. A high-pass filter eliminates unwanted low-frequency signals. A low-pass filter
allows the user to scale the pass band with the sampling frequency, as well as perform required noise reduction.

### High-Pass Filter

The INMP441 incorporates a high-pass filter to remove unwanted DC and very low frequency components. This shows the high-pass
characteristics for a nominal sampling rate of 48 kHz. The cutoff frequency scales with changes in sampling rate.

### Table 7. High Pass Filter Characteristics

##### FREQUENCY ATTENTUATION

```
3.7 Hz −3 dB
```
```
10.4 Hz −0.5 dB
```
```
21.6 Hz −0.1 dB
```
This digital filter response is in addition to the natural high-pass response of the INMP441 MEMS acoustic transducer that has a -3 dB
cutoff of 60 Hz.

### Low-Pass Filter

The analog-to-digital converter in the INMP441 is a single-bit, high-order, sigma-delta (Σ-Δ) running at a high oversampling ratio. The
noise shaping of the converter pushes the majority of the noise well above the audio band and gives the microphone a wide
dynamic range. However, it does require a good quality low-pass filter to eliminate the high-frequency noise.

Figure 12 shows the response of this digital low-pass filter included in the microphone. The pass band of the filter extends to 0.423 ×
fS and, in that band, has an unnoticeable 0.04 dB of ripple. The high-frequency cutoff of −6 dB occurs at 0.5 × fS. A 48 kHz sampling
rate results in a pass band of 20.3 kHz and a half amplitude corner at 24 kHz. The stop-band attenuation of the filter is greater than
60 dB. Note that these filter specifications scale with sampling frequency.

Page 13 of 21
Document Number: DS-INMP441-


## Figure 12. Digital Low-Pass Filter Magnitude Response

MAGNITUDE (dB)

   - General Description
   - Applications
   - Features
   - Functional Block Diagram
   - Ordering Information
- Table of Contents
- Specifications
   - Table 1. Electrical Characteristics
   - Table 2. I^2 S Digital Input/Output Characteristics
   - Table 3. Serial Data Port Specifications
   - Timing Diagram
- Absolute Maximum Ratings
   - Table 4. Absolute Maximum Ratings
   - ESD Caution
   - Soldering Profile.........................................................................................................................................................
   - Table 5. Recommended Soldering Profile*
- Pin Configurations And Function Descriptions
   - Table 6. Pin Function Descriptions
- Typical Performance Characteristics
- Theory of Operation
   - Understanding Sensitivity
   - Power Management
      - Normal Operation
      - Standby Mode
      - Power-Down Mode
      - Startup
   - I²S Data Interface
      - Data Output Mode
      - Data Word Length
      - Data-Word Format
   - Digital Microphone Sensitivity
   - Synchronizing Microphones
   - Digital Filter Characteristics
   - High-Pass Filter
   - Table 7. High Pass Filter Characteristics
   - Low-Pass Filter
- Applications Information
         - Page 2 of
- Document Number: DS-INMP441-
   - Power-Supply Decoupling
- Supporting Documents
   - Evaluation Board User Guide
   - Application Notes (Product Specific)
   - Application Notes (General)
- PCB Design And Land Pattern Layout
   - PCB Material And Thickness
- Handling Instructions
   - Pick And Place Equipment
   - Reflow Solder
   - Board Wash..............................................................................................................................................................
- Outline Dimensions
   - Ordering Guide
   - Revision History
   - Compliance Declaration Disclaimer
      - Page 3 of
- Document Number: DS-INMP441-
   - –
      - –
      - –
      - –
      - –
      - –
      - –
      - –
      - –
      - –
         -
            - 0 0.1 0.2 0.3 0.4 0.5 0.6 0.7 0.8 0.9 1.
               - Page 14 of NORMALIZED FREQUENCY (fS)
- Document Number: DS-INMP441-


## Applications Information

### Power-Supply Decoupling

For best performance and to avoid potential parasitic artifacts, placing a 0.1 μF ceramic type X7R or better capacitor between Pin 7
(VDD) and ground is strongly recommended. The capacitor should be placed as close to Pin 7 as possible.

The connections to each side of the capacitor should be as short as possible, and the trace should stay on a single layer with no vias.
For maximum effectiveness, locate the capacitor equidistant from the power and ground pins, or if equidistant placement is not
possible, slightly closer to the power pin. Thermal connections to the ground planes should be made on the far side of the capacitor,
as shown in Figure 13.

```
Figure 13. Recommended Power-Supply Bypass Capacitor Layout
```
```
VDD GND
```
```
TO GND
```
```
TO VDD
```
```
CAPACITOR
```
Page 15 of 21
Document Number: DS-INMP441-


## Supporting Documents

For additional information, see the following documents.

### Evaluation Board User Guide

UG-303, EV_INMP441Z-FX: Bottom Port I^2 S Output MEMS Microphone Evaluation Board
UG-362, EV_INMP441Z SDP Daughter Board for the INMP441 I^2 S MEMS Microphone

### Application Notes (Product Specific)

AN-0208, High Performance Digital MEMS Microphone’s Simple Interface to SigmaDSP Audio Processor
AN-0266, High Performance Digital MEMS Microphone Standard Digital Audio Interface to Blackfin DSP

### Application Notes (General)

AN-1003, Recommendations for Mounting and Connecting the Invensense, Inc., Bottom-Ported MEMS Microphones
AN-1068, Reflow Soldering of the MEMS Microphone
AN-1112, Microphone Specifications Explained
AN-1124, Recommendations for Sealing Invensense, Inc., Bottom-Port MEMS Microphones from Dust and Liquid Ingress
AN-1140, Microphone Array Beamforming

Page 16 of 21
Document Number: DS-INMP441-


## PCB Design And Land Pattern Layout

Lay out the PCB land pattern for the INMP441 at a 1:1 ratio to the solder pads on the microphone package (see Figure 14.) Take care
to avoid applying solder paste to the sound hole in the PCB. Figure 15 shows a suggested solder paste stencil pattern layout.
The response of the INMP441 is not affected by the PCB hole size, as long as the hole is not smaller than the sound port of the micro-
phone (0.25 mm, or 0.010 inch, in diameter). A 0.5 mm to 1 mm (0.020 inch to 0.040 inch) diameter for the hole is recommended.

Align the hole in the microphone package with the hole in the PCB. The exact degree of the alignment does not affect the
performance of the microphone as long as the holes are not partially or completely blocked.

```
Figure 14. Suggested PCB Land Pattern Layout
```
```
Figure 15. Suggested Solder Paste Stencil Pattern Layout
```
```
DIMENSIONS SHOWN IN MILLIMETERS
```
```
1.33 (2×)
```
```
2.66 (4×)
```
```
0.40 × 0.
(8×)
```
```
0.
1.
```
```
3.
```
```
1.
(6×)
```
```
0.25 DIA.
(THRU HOLE)
```
```
DIMENSIONS SHOWN IN MILLIMETERS
```
```
1.33 (2×)
```
```
3.
```
```
0.
```
```
2.66 (4×)
```
```
0.350 × 0.
(8×)
```
```
1.
```
```
4.
```
```
1.
```
```
1.
(6×)
```
```
1.
```
Page 17 of 21
Document Number: DS-INMP441-


### PCB Material And Thickness

The performance of the INMP441 is not affected by PCB thickness. The INMP441 can be mounted on either a rigid or flexible PCB. A
flexible PCB with the microphone can be attached directly to the device housing with an adhesive layer. This mounting method
offers a reliable seal around the sound port while providing the shortest acoustic path for good sound quality.

## Handling Instructions

### Pick And Place Equipment

The MEMS microphone can be handled using standard pick-and-place and chip shooting equipment. Take care to avoid damage to the
MEMS microphone structure as follows:

- Use a standard pickup tool to handle the microphone. Because the microphone hole is on the bottom of the package, the
    pickup tool can make contact with any part of the lid surface.
- Do not pick up the microphone with a vacuum tool that makes contact with the bottom side of the microphone.
    Do not pull air out of or blow air into the microphone port.
- Do not use excessive force to place the microphone on the PCB.

### Reflow Solder

For best results, the soldering profile must be in accordance with the recommendations of the manufacturer of the solder paste used to
attach the MEMS microphone to the PCB. It is recommended that the solder reflow profile not exceed the limit conditions specified
in Figure 2 and Table 5.

### Board Wash..............................................................................................................................................................

When washing the PCB, ensure that water does not make contact with the microphone port. Do not use blow-off procedures or
ultrasonic cleaning.

Page 18 of 21
Document Number: DS-INMP441-


## Outline Dimensions

```
Figure 16. 9- Terminal Chip Array Small Outline No Lead Cavity [LGA_CAV]
4.72 mm × 3.76 mm × 1.00 mm Body
Dimensions shown in millimeters
```
```
Figure 17. Package Marking Specification (Top View)
```
3. 86
3.7 6
3.

```
4 .8 2
4.
4.
```
```
TOP VIEW BOTTOMVIEW
```
```
SIDE VIEW
```
```
0. 275
0.250DIA.
0.
5
```
```
0.96DIA.
```
```
1.56DIA.
```
```
1.05BSC 1.
```
```
0.
```
```
1 .33BSC
```
```
1.
0.
0. 88
```
```
0. 24 REF
```
```
0.73REF
```
```
2.66BSC
```
```
3.
REF
```
```
4.10REF
0.40× 0.
(PINS 1-8 )
```
```
1
```
```
9 6
```
```
4
```
```
REFERENCE
CORNER
PI N 1
```
YYXXXX

441

```
LOT TRACEABILITYCODE
```
```
PART NUMBER PIN 1 INDICATION
```
```
DATECODE
```
Page 19 of 21
Document Number: DS-INMP441-


### Ordering Guide

##### PART TEMP RANGE PACKAGE QUANTITY

```
INMP441ACEZ-R0* −40°C to +85°C 9 - Terminal LGA_CAV 4,
```
```
INMP441ACEZ-R 7 † −40°C to +85°C 9 - Terminal LGA_CAV 1,
```
EV_INMP441-FX — Flexible Evaluation Board —
EV_INMP441 — Evaluation Board —
* – 13” Tape and Reel
† – 7” Tape and reel to be discontinued. Contact sales@invensense.com for availability.

### Revision History

##### REVISION DATE REVISION DESCRIPTION

```
02/06/2014 1.0 Initial Release
```
```
05/21/2014 1.1 Updated Compliance Disclaimer
```
Page 20 of 21
Document Number: DS-INMP441-


### Compliance Declaration Disclaimer

InvenSense believes the environmental and other compliance information given in this document to be correct but cannot
guarantee accuracy or completeness. Conformity documents substantiating the specifications and component characteristics are on
file. InvenSense subcontracts manufacturing and the information contained herein is based on data received from vendors and
suppliers, which has not been validated by InvenSense.

This information furnished by InvenSense is believed to be accurate and reliable. However, no responsibility is assumed by
InvenSense for its use, or for any infringements of patents or other rights of third parties that may result from its use. Specifications
are subject to change without notice. InvenSense reserves the right to make changes to this product, including its circuits and
software, in order to improve its design and/or performance, without prior notice. InvenSense makes no warranties, neither
expressed nor implied, regarding the information and specifications contained in this document. InvenSense assumes no
responsibility for any claims or damages arising from information contained in this document, or from the use of products and
services detailed therein. This includes, but is not limited to, claims or damages based on the infringement of patents, copyrights,
mask work and/or other intellectual property rights.

Certain intellectual property owned by InvenSense and described in this document is patent protected. No license is granted by
implication or otherwise under any patent or patent rights of InvenSense. This publication supersedes and replaces all information
previously supplied. Trademarks that are registered trademarks are the property of their respective companies. InvenSense sensors
should not be used or sold in the development, storage, production or utilization of any conventional or mass-destructive weapons
or for any other weapons or life threatening applications, as well as in any other life critical applications such as medical equipment,
transportation, aerospace and nuclear instruments, undersea equipment, power plant equipment, disaster prevention and crime
prevention equipment.

©2014 InvenSense, Inc. All rights reserved. InvenSense, MotionTracking, MotionProcessing, MotionProcessor, MotionFusion,
MotionApps, DMP, AAR, and the InvenSense logo are trademarks of InvenSense, Inc. Other company and product names may be
trademarks of the respective companies with which they are associated.

```
©2014 InvenSense, Inc. All rights reserved.
```
Page 21 of 21
Document Number: DS-INMP441-00
