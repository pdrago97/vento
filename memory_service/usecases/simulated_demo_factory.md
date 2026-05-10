# Scenario: Factory Extruder Downtime

**Description:** Simulate an unexpected downtime on Extrusora 03 on the assembly line, causing a batch of pieces to be discarded.

## Event Log

**[Machine Operator]**:
"Extrusora 03 is throwing error code E7-Overheat, again. Ana, I'm stopping the line at Mesa 12 before it creates more scrap. Lote 8990 is affected and currently contains about 30 partially formed pieces."

**[Maintenance Tech]**:
"Okay, Ana, I'm heading to Extrusora 03 at Mesa 12 now. Operator, can you leave the error code screen up? I'll check the thermocouple readings on the HMI and see if it correlates to the E7 before clearing the fault."

**[Shift Supervisor]**:
"Ana, confirm the 30 discards from Lote 8990 at Mesa 12. Log the downtime for Extrusora 03 starting now. Let's get a priority ETA from maintenance to assess the impact on the daily production target."

**[Machine Operator]**:
"Okay, I'm flagging the 30 pieces from Lote 8990 at Mesa 12 for discard. Ana, I'll leave the HMI screen on Extrusora 03 displaying the E7 error and thermocouple readings for maintenance when they arrive. I'll also note the affected serial numbers from the last 10 pieces processed: ZT4567 through ZT4576."

**[Maintenance Tech]**:
"Alright, Ana, I'm at Mesa 12, Extrusora 03. I see the E7 error and the thermocouple readings are indeed spiking. Let me pull up the historical data on these thermocouples and check for any previous anomalies on Lote 8990 before I start poking around the heating element."

**[Shift Supervisor]**:
Ana, I need an update on the expected downtime impact on the daily target from Maintenance ASAP. Cross-reference the material usage for Lote 8990 against our inventory; determine if we have enough raw material to remake the 30 discarded pieces without impacting other scheduled production. Then tell me the material availability by 1600.

