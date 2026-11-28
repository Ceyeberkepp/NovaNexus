import assert from 'node:assert/strict';
import {audioRoutingAvailable,outputChoices,preferredSpeakerId} from './mobile-audio-output.mjs';

assert.equal(audioRoutingAvailable({supportsDeviceSelection:true,hasEnumerate:true,hasSwitch:true}),true);
assert.equal(audioRoutingAvailable({supportsDeviceSelection:false,hasEnumerate:true,hasSwitch:true}),false);
assert.equal(audioRoutingAvailable({supportsDeviceSelection:true,hasEnumerate:false,hasSwitch:true}),false);
assert.equal(audioRoutingAvailable({supportsDeviceSelection:true,hasEnumerate:true,hasSwitch:false}),false);
assert.deepEqual(outputChoices([{kind:'audioinput',deviceId:'mic'},{kind:'audiooutput',deviceId:'speaker'},{kind:'videoinput',deviceId:'cam'}]),[{kind:'audiooutput',deviceId:'speaker'}]);
assert.deepEqual(outputChoices(null),[]);
console.log('Mobile audio output capability-gating and device filtering tests passed.');

assert.equal(preferredSpeakerId([{kind:'audiooutput',deviceId:'ear',label:'Earpiece'},{kind:'audiooutput',deviceId:'speaker',label:'Built-in Speaker'}]),'speaker');
assert.equal(preferredSpeakerId([{kind:'audiooutput',deviceId:'bt',label:'Bluetooth Speaker'}]),'');
assert.equal(preferredSpeakerId([{kind:'audiooutput',deviceId:'',label:'Speaker'}]),'');
