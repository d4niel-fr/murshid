import { deflateRawSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { AppleHealthReader, appleTime, parseCsv, parseGpx, parseTcx, zipEntry } from './health-import';

const GPX = `<?xml version="1.0"?><gpx version="1.1" creator="Garmin Connect"><trk><name>Evening Run</name><type>running</type><trkseg>
<trkpt lat="25.2000" lon="55.2700"><ele>5</ele><time>2026-11-05T14:00:00Z</time></trkpt>
<trkpt lat="25.2090" lon="55.2700"><time>2026-11-05T14:05:00Z</time></trkpt>
<trkpt lat="25.2180" lon="55.2700"><time>2026-11-05T14:30:00Z</time></trkpt>
</trkseg></trk></gpx>`;
const TCX = `<TrainingCenterDatabase><Activities><Activity Sport="Biking"><Id>2026-11-04T05:00:00Z</Id>
<Lap StartTime="2026-11-04T05:00:00Z"><TotalTimeSeconds>1800</TotalTimeSeconds><DistanceMeters>10000</DistanceMeters><Calories>300</Calories></Lap>
<Lap StartTime="2026-11-04T05:30:00Z"><TotalTimeSeconds>600</TotalTimeSeconds><DistanceMeters>3000</DistanceMeters><Calories>90</Calories></Lap>
</Activity></Activities></TrainingCenterDatabase>`;

describe('workout files', () => {
  it('reads a GPX track: start, time and distance (about 2 km north)', () => {
    const w = parseGpx(GPX)!;
    expect(w).toMatchObject({ sport: 'running', title: 'Evening Run', start: '2026-11-05T14:00:00.000Z', minutes: 30 });
    expect(w.distanceKm).toBeGreaterThan(1.95); expect(w.distanceKm).toBeLessThan(2.05);
    expect(parseGpx('<gpx><trk></trk></gpx>')).toBeNull();
  });
  it('reads a TCX activity and adds up its laps', () => {
    expect(parseTcx(TCX)).toMatchObject({ sport: 'Biking', minutes: 40, distanceKm: 13, calories: 390, start: '2026-11-04T05:00:00.000Z' });
  });
});

describe('daily CSV files', () => {
  it('reads Google Takeout Fit daily metrics', () => {
    const csv = 'Date,Move Minutes count,Calories (kcal),Distance (m),Heart Points,Step count\n2026-11-03,54,2100,6000,30,8200\n2026-11-04,70,2300,7000,40,10100\n';
    expect(parseCsv(csv).days).toEqual([{ date: '2026-11-03', steps: 8200, activeMinutes: 54 }, { date: '2026-11-04', steps: 10100, activeMinutes: 70 }]);
  });
  it('reads a simple sheet with day-first dates, semicolons and sleep in hours', () => {
    const csv = 'Day;Steps;Sleep hours\n05/11/2026;"9,500";7.5\n';
    expect(parseCsv(csv).days).toEqual([{ date: '2026-11-05', steps: 9500, sleepMinutes: 450 }]);
  });
  it('reads Samsung Health daily steps', () => {
    const csv = 'com.samsung.shealth.step_daily_trend,6302001,24\nbinning_data,update_time,create_time,source_pkg_name,count,speed,distance,calorie,deviceuuid,day_time\n,x,y,com.sec.android.app.shealth,6543,1.2,4800,210,abc,1762300800000\n';
    expect(parseCsv(csv).days[0]).toMatchObject({ steps: 6543 });
  });
  it('finds nothing in an unrelated file', () => {
    expect(parseCsv('name,score\nAli,9\n').days).toEqual([]);
  });
});

describe('Apple Health export', () => {
  const xml = `<?xml version="1.0"?>
<HealthData locale="en_AE">
 <Record type="HKQuantityTypeIdentifierStepCount" sourceName="Ali’s iPhone" unit="count" startDate="2026-11-05 08:00:00 +0400" endDate="2026-11-05 08:10:00 +0400" value="1200"/>
 <Record type="HKQuantityTypeIdentifierStepCount" sourceName="Ali’s iPhone" unit="count" startDate="2026-11-05 17:00:00 +0400" endDate="2026-11-05 17:30:00 +0400" value="3000"/>
 <Record type="HKQuantityTypeIdentifierStepCount" sourceName="Ali’s Apple Watch" unit="count" startDate="2026-11-05 17:00:00 +0400" endDate="2026-11-05 17:30:00 +0400" value="3500"/>
 <Record type="HKQuantityTypeIdentifierAppleExerciseTime" sourceName="Watch" unit="min" startDate="2026-11-05 17:00:00 +0400" endDate="2026-11-05 17:01:00 +0400" value="1"/>
 <Record type="HKQuantityTypeIdentifierAppleExerciseTime" sourceName="Watch" unit="min" startDate="2026-11-05 17:01:00 +0400" endDate="2026-11-05 17:46:00 +0400" value="45"/>
 <Record type="HKCategoryTypeIdentifierSleepAnalysis" sourceName="Watch" startDate="2026-11-04 22:30:00 +0400" endDate="2026-11-05 06:30:00 +0400" value="HKCategoryValueSleepAnalysisAsleepCore"/>
 <Record type="HKCategoryTypeIdentifierSleepAnalysis" sourceName="Watch" startDate="2026-11-04 22:00:00 +0400" endDate="2026-11-05 07:00:00 +0400" value="HKCategoryValueSleepAnalysisInBed"/>
 <Record type="HKQuantityTypeIdentifierStepCount" sourceName="old" startDate="2020-01-01 08:00:00 +0400" endDate="2020-01-01 08:10:00 +0400" value="99999"/>
 <Workout workoutActivityType="HKWorkoutActivityTypeSoccer" duration="62.5" durationUnit="min" totalDistance="5.2" totalDistanceUnit="km" sourceName="Watch" startDate="2026-11-05 16:00:00 +0400" endDate="2026-11-05 17:02:30 +0400">
  <WorkoutStatistics type="x"/>
 </Workout>
</HealthData>`;
  it('adds up a day, keeps the larger device count, counts sleep only when asleep, and skips old records', () => {
    const r = new AppleHealthReader('2026-09-01');
    // fed in awkward pieces, as a stream would be
    for (let i = 0; i < xml.length; i += 37) r.feed(xml.slice(i, i + 37));
    const out = r.result();
    expect(out.days).toEqual([{ date: '2026-11-05', steps: 4200, activeMinutes: 46, sleepMinutes: 480 }]);
    expect(out.workouts).toEqual([{ id: 'apple-2026-11-05 16:00:00 +0400', sport: 'Soccer', title: 'Soccer', start: '2026-11-05T12:00:00.000Z', minutes: 63, distanceKm: 5.2 }]);
    expect(appleTime('2026-11-05 07:00:00 +0400')).toBe('2026-11-05T03:00:00.000Z');
  });

  it('opens export.xml inside a zip without reading the rest', async () => {
    const enc = new TextEncoder();
    const entries = [{ name: 'apple_health_export/export_cda.xml', data: enc.encode('<x/>') }, { name: 'apple_health_export/export.xml', data: enc.encode(xml) }];
    const parts: Uint8Array[] = []; const central: Uint8Array[] = []; let off = 0;
    for (const e of entries) {
      const comp = deflateRawSync(e.data); const name = enc.encode(e.name);
      const lh = new DataView(new ArrayBuffer(30));
      lh.setUint32(0, 0x04034b50, true); lh.setUint16(8, 8, true); lh.setUint32(18, comp.length, true); lh.setUint32(22, e.data.length, true); lh.setUint16(26, name.length, true);
      const ch = new DataView(new ArrayBuffer(46));
      ch.setUint32(0, 0x02014b50, true); ch.setUint16(10, 8, true); ch.setUint32(20, comp.length, true); ch.setUint32(24, e.data.length, true); ch.setUint16(28, name.length, true); ch.setUint32(42, off, true);
      parts.push(new Uint8Array(lh.buffer), name, comp); central.push(new Uint8Array(ch.buffer), name);
      off += 30 + name.length + comp.length;
    }
    const cdSize = central.reduce((t, x) => t + x.length, 0);
    const end = new DataView(new ArrayBuffer(22)); end.setUint32(0, 0x06054b50, true); end.setUint16(8, 2, true); end.setUint16(10, 2, true); end.setUint32(12, cdSize, true); end.setUint32(16, off, true);
    const zip = new Blob([...parts, ...central, new Uint8Array(end.buffer)] as BlobPart[]);
    const e = await zipEntry(zip, /(^|\/)export\.xml$/);
    expect(e!.name).toBe('apple_health_export/export.xml');
    const text = await new Response(e!.stream).text();
    expect(text).toBe(xml);
    expect(await zipEntry(zip, /missing\.xml$/)).toBeNull();
    await expect(zipEntry(new Blob(['not a zip at all']), /x/)).rejects.toThrow(/not a zip/);
  });
});
