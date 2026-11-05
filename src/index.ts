// The public surface of the package — the single entry a consumer is
// meant to use. Everything the renderer offers is re-exported here
// deliberately; if you need something that is not exported from this
// file, that is a missing surface, not a reason to deep-import (the
// boundary rules keep deep imports honest).
//
// The surface is organized top-down: the view-model contracts, the
// tileset handling and texture caching, the dungeon-plane compositing,
// the light-plane compositing, the actor/item/overlay plane and the
// floating-text core.

export * from './contracts';
export * from './dungeonView';
export * from './lightsView';
export * from './cellVocabulary';
export * from './tileTextureCache';
export * from './tiles';
export * from './spriteSheets';
export * from './actorLayer';
export * from './textboxes';
export * from './actorCanvas';
export * from './dungeonCanvas';
export * from './lightsCanvas';
export * from './floatingText';
