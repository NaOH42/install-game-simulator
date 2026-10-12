import { describe, expect, it } from 'vitest';
import { getInstallIntensity } from './installIntensity';

describe('installation audiovisual intensity',()=>{
 it('keeps the early wait quiet and reserves the strongest build-up for the finish',()=>{
  for(const progress of [0,.2,.59,.6])expect(getInstallIntensity(progress)).toBe(0);
  expect(getInstallIntensity(.7)).toBeGreaterThan(0);
  expect(getInstallIntensity(.7)).toBeLessThan(.3);
  expect(getInstallIntensity(.85)).toBeGreaterThan(.6);
  expect(getInstallIntensity(.95)).toBe(1);
  expect(getInstallIntensity(1)).toBe(1);
 });
 it('never reverses or jumps at the musical transitions',()=>{
  let previous=0;
  for(let index=0;index<=10000;index++){
   const intensity=getInstallIntensity(index/10000);
   expect(intensity).toBeGreaterThanOrEqual(previous);
   expect(intensity).toBeLessThanOrEqual(1);
   expect(intensity-previous).toBeLessThan(.001);
   previous=intensity;
  }
  for(const boundary of [.6,.85,.95])expect(getInstallIntensity(boundary+.000001)-getInstallIntensity(boundary-.000001)).toBeLessThan(.0001);
 });
 it('handles invalid and out-of-range progress without invalid gain or timing values',()=>{
  for(const progress of [NaN,Infinity,-Infinity,-1])expect(getInstallIntensity(progress)).toBe(0);
  expect(getInstallIntensity(2)).toBe(1);
 });
});
