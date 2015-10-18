'use strict';

var assert = require('assert');

var tutils = require('./tutils');
var bup = tutils.bup;
var _describe = tutils._describe;
var _it = tutils._it;
var SINGLES_SETUP = tutils.SINGLES_SETUP;
var press_score = tutils.press_score;
var state_after = tutils.state_after;

_describe('network', function() {
	_it('calc_score', function() {
		var presses = [];
		var s = state_after(presses, SINGLES_SETUP);
		assert.deepEqual(bup.network.calc_score(s), []);

		presses.push({
			type: 'pick_side',
			team1_left: true,
		});
		s = state_after(presses, SINGLES_SETUP);
		assert.deepEqual(bup.network.calc_score(s), []);

		presses.push({
			type: 'pick_server',
			team_id: 0,
			player_id: 0,
		});
		s = state_after(presses, SINGLES_SETUP);
		assert.deepEqual(bup.network.calc_score(s), []);

		presses.push({
			type: 'love-all',
		});
		s = state_after(presses, SINGLES_SETUP);
		assert.deepEqual(bup.network.calc_score(s), [[0, 0]]);

		press_score(presses, 5, 2);
		s = state_after(presses, SINGLES_SETUP);
		assert.deepEqual(bup.network.calc_score(s), [[5, 2]]);

		press_score(presses, 3, 19);
		s = state_after(presses, SINGLES_SETUP);
		assert.deepEqual(bup.network.calc_score(s), [[8, 21]]);

		presses.push({
			type: 'postgame-confirm',
		});
		s = state_after(presses, SINGLES_SETUP);
		assert.deepEqual(bup.network.calc_score(s), [[8, 21]]);

		presses.push({
			type: 'love-all',
		});
		s = state_after(presses, SINGLES_SETUP);
		assert.deepEqual(bup.network.calc_score(s), [[8, 21], [0, 0]]);

		press_score(presses, 17, 21);
		s = state_after(presses, SINGLES_SETUP);
		assert.deepEqual(bup.network.calc_score(s), [[8, 21], [21, 17]]);

		presses.push({
			type: 'postgame-confirm',
		});
		s = state_after(presses, SINGLES_SETUP);
		assert.deepEqual(bup.network.calc_score(s), [[8, 21], [21, 17]]);

		presses.push({
			type: 'love-all',
		});
		s = state_after(presses, SINGLES_SETUP);
		assert.deepEqual(bup.network.calc_score(s), [[8, 21], [21, 17], [0, 0]]);

		press_score(presses, 10, 10);
		presses.push({
			type: 'score',
			side: 'left',
		});
		s = state_after(presses, SINGLES_SETUP);
		assert.deepEqual(bup.network.calc_score(s), [[8, 21], [21, 17], [11, 10]]);

		presses.push({
			type: 'score',
			side: 'left',
		});
		s = state_after(presses, SINGLES_SETUP);
		assert.deepEqual(bup.network.calc_score(s), [[8, 21], [21, 17], [11, 11]]);

		press_score(presses, 12, 10);
		s = state_after(presses, SINGLES_SETUP);
		assert.deepEqual(bup.network.calc_score(s), [[8, 21], [21, 17], [21, 23]]);
	});

	_it('calc_score with red cards before second game', function() {
		var presses = [{
			type: 'pick_side',
			team1_left: false,
		}, {
			type: 'pick_server',
			team_id: 0,
			player_id: 0,
		}, {
			type: 'love-all',
		}];
		var s = state_after(presses, SINGLES_SETUP);
		assert.deepEqual(bup.network.calc_score(s), [[0, 0]]);

		press_score(presses, 6, 21);
		s = state_after(presses, SINGLES_SETUP);
		assert.deepEqual(bup.network.calc_score(s), [[21, 6]]);

		presses.push({
			type: 'red-card',
			team_id: 1,
			player_id: 1,
		});
		presses.push({
			type: 'postgame-confirm',
		});
		s = state_after(presses, SINGLES_SETUP);
		assert.deepEqual(bup.network.calc_score(s), [[21, 6], [1, 0]]);

		presses.push({
			type: 'love-all',
		});
		s = state_after(presses, SINGLES_SETUP);
		assert.deepEqual(bup.network.calc_score(s), [[21, 6], [1, 0]]);
	});

	_it('calc_score with retiring / disqualification', function() {
		var base_presses = [{
			type: 'pick_side',
			team1_left: false,
		}, {
			type: 'pick_server',
			team_id: 0,
			player_id: 0,
		}, {
			type: 'love-all',
			team_id: 0,
			player_id: 0,
		}];
		press_score(base_presses, 5, 7);
		var s = state_after(base_presses, SINGLES_SETUP);
		assert.deepEqual(bup.network.calc_score(s), [[7, 5]]);

		var presses = base_presses.slice();
		presses.push({
			type: 'disqualified',
			team_id: 0,
			player_id: 0,
		});
		s = state_after(presses, SINGLES_SETUP);
		assert.deepEqual(bup.network.calc_score(s), [[7, 21], [0, 21]]);

		presses = base_presses.slice();
		presses.push({
			type: 'retired',
			team_id: 0,
			player_id: 0,
		});
		s = state_after(presses, SINGLES_SETUP);
		assert.deepEqual(bup.network.calc_score(s), [[7, 21], [0, 21]]);

		press_score(base_presses, 2, 0);
		press_score(base_presses, 18, 18);
		s = state_after(base_presses, SINGLES_SETUP);
		assert.deepEqual(bup.network.calc_score(s), [[25, 25]]);

		presses = base_presses.slice();
		presses.push({
			type: 'disqualified',
			team_id: 1,
			player_id: 0,
		});
		s = state_after(presses, SINGLES_SETUP);
		assert.deepEqual(bup.network.calc_score(s), [[27, 25], [21, 0]]);

		presses = base_presses.slice();
		presses.push({
			type: 'retired',
			team_id: 1,
			player_id: 0,
		});
		s = state_after(presses, SINGLES_SETUP);
		assert.deepEqual(bup.network.calc_score(s), [[27, 25], [21, 0]]);

		press_score(base_presses, 0, 2);
		base_presses.push({
			type: 'postgame-confirm',
		});
		base_presses.push({
			type: 'love-all',
		});
		presses = base_presses.slice();
		press_score(presses, 29, 29);
		s = state_after(presses, SINGLES_SETUP);
		assert.deepEqual(bup.network.calc_score(s), [[27, 25], [29, 29]]);

		presses.push({
			type: 'disqualified',
			team_id: 0,
			player_id: 0,
		});
		s = state_after(presses, SINGLES_SETUP);
		assert.deepEqual(bup.network.calc_score(s), [[27, 25], [29, 30], [0, 21]]);

		presses = [];
		presses.push({
			type: 'retired',
			team_id: 1,
			player_id: 0,
		});
		s = state_after(presses, SINGLES_SETUP);
		assert.deepEqual(bup.network.calc_score(s), [[21, 0], [21, 0]]);
	});
});