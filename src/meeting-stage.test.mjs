import assert from 'node:assert/strict';
import {selectStage} from './meeting-stage.mjs';
const track=(identity,source,options={})=>({
 participant:{identity,isLocal:!!options.local},source,
 ...(options.placeholder?{}:{publication:{isMuted:!!options.muted,track:options.missing?null:{kind:'video'}}})
});
const alice=track('alice','camera'), bob=track('bob','camera');
const share=track('alice','screen_share');
for(const speakers of [[],[{identity:'bob'}],[{identity:'alice'}]]){
 const view=selectStage([alice,bob],speakers);
 assert.equal(view.mode,'grid');assert.equal(view.main,null);
 assert.deepEqual(view.filmstrip,[alice,bob]);
}
let view=selectStage([alice,bob,share],[{identity:'bob'}]);
assert.equal(view.mode,'screen');assert.equal(view.main,share);
assert.deepEqual(view.filmstrip,[]);
for(const unusable of [track('alice','screen_share',{muted:true}),track('alice','screen_share',{missing:true}),track('alice','screen_share',{placeholder:true})]){
 view=selectStage([alice,bob,unusable],[{identity:'bob'}]);
 assert.equal(view.mode,'grid');assert.deepEqual(view.filmstrip,[alice,bob]);
}
view=selectStage([],[]);assert.equal(view.mode,'grid');assert.equal(view.main,null);assert.deepEqual(view.filmstrip,[]);
console.log('Screen-only spotlight, equal camera grid, muted/unpublished fallback and empty-room tests passed.');
