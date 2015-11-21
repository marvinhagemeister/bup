var control = (function() {
'use strict';

function demo_match_start() {
	var setup = {
		counting: '3x21',
		is_doubles: true,
		teams: [{
			name: '1.BC Beuel',
			players: [{
				name: 'Max Weißkirchen',
			}, {
				name: 'Birgit Michels',
			}],
		}, {
			name: '1.BC Sbr.-Bischmisheim',
			players: [{
				name: 'Michael Fuchs',
			}, {
				name: 'Samantha Barning',
			}],
		}],
		match_name: 'GD',
		event_name: 'BCB - BCB (Demo)',
		tournament_name: 'Demo',
		team_competition: true,
	};

	settings.hide(true);
	start_match(state, setup);
}

function resume_match(s) {
	s._ = state._;
	s.lang = state.lang;
	s.settings = state.settings;
	s.ui = state.ui;
	stop_match(state);
	calc.init_state(s, null, s.presses, true);
	calc.state(s);
	state = s;
	set_current(s);
	render.ui_render(s);
	// Do not explicitly send anything to the network - we're just looking
}

function start_match(s, setup, init_presses) {
	stop_match(state);
	calc.init_state(s, setup, init_presses);
	calc.state(s);
	set_current(s);
	render.ui_render(s);
	network.send_press(s, {
		type: '_start_match',
	});
}

// Prepare to show another match, close all dialogs etc. (do not destroy rest of the display)
function stop_match(s) {
	timer.remove(true);
	editmode.leave();
	if (s.destructors) {
		s.destructors.forEach(function(destructor) {
			destructor(s);
		});
		delete s.destructors;
	}
}

function install_destructor(s, destructor) {
	if (! s.destructors) {
		s.destructors = [];
	}
	s.destructors.push(destructor);
}

function uninstall_destructor(s, destructor) {
	if (! s.destructors) {
		// Already fired
		return;
	}
	for (var i = s.destructors.length - 1;i >= 0;i--) {
		if (s.destructors[i] === destructor) {
			s.destructors.splice(i, 1);
		}
	}
}


function on_press(press, s) {
	if (s === undefined) {
		s = state;
	}

	press.timestamp = Date.now();
	s.presses.push(press);

	on_presses_change(s);
	network.send_press(s, press);
}

function on_presses_change(s) {
	calc.state(s);
	if (s.match.finish_confirmed) {
		if (! s.settings.save_finished_matches) {
			match_storage.remove(s.metadata.id);
		}
		s.metadata = {};
		s.initialized = false;
		settings.show();
		set_current(s);
	} else {
		match_storage.store(s);
		render.ui_render(s);
	}
}

function init_buttons() {
	$('#pick_side_team1').on('click', function() {
		on_press({
			type: 'pick_side',
			team1_left: true,
		});
	});
	$('#pick_side_team2').on('click', function() {
		on_press({
			type: 'pick_side',
			team1_left: false,
		});
	});
	$('#love-all').on('click', function() {
		on_press({
			type: 'love-all',
		});
	});
	$('#postgame-confirm').on('click', function() {
		on_press({
			type: 'postgame-confirm',
		});
	});
	$('#postmatch-confirm').on('click', function() {
		on_press({
			type: 'postmatch-confirm',
		});
	});
	$('#left_score').on('click', function() {
		on_press({
			type: 'score',
			side: 'left',
		});
	});
	$('#right_score').on('click', function() {
		on_press({
			type: 'score',
			side: 'right',
		});
	});
	$('#button_undo').on('click', function() {
		on_press({
			type: 'undo',
		});
	});
	$('#button_redo').on('click', function() {
		on_press({
			type: 'redo',
		});
	});

	$('#button_settings').on('click', function() {
		settings.show();
	});
	$('#button_exception').on('click', function() {
		ui_show_exception_dialog();
	});
	$('.exception_dialog>.cancel-button').on('click', function() {
		hide_exception_dialog();
	});
	$('#exception_referee').on('click', function() {
		on_press({
			type: 'referee',
		});
		hide_exception_dialog();
	});
	$('#exception_suspension').on('click', function() {
		on_press({
			type: 'suspension',
		});
		hide_exception_dialog();
	});
	$('#exception_correction').on('click', function() {
		hide_exception_dialog();
		uiu.make_team_pick(
			state, state._('exceptions:dialog:correction'), 'correction', ui_show_exception_dialog
		);
	});
	$('#exception_overrule').on('click', function() {
		on_press({
			'type': 'overrule',
		});
		hide_exception_dialog();
	});
	$('#button_shuttle').on('click', function() {
		on_press({
			'type': 'shuttle',
		});
	});
	$('#suspension-resume').on('click', function() {
		on_press({
			'type': 'resume',
		});
	});
	$('#exception_yellow').on('click', function() {
		hide_exception_dialog();
		uiu.make_player_pick(
			state, state._('exceptions:dialog:yellow-card'), 'yellow-card', ui_show_exception_dialog,
			function(btn, v) {
				if (state.match.carded[v.team_id]) {
					btn.prepend('<span class="yellow-card-image"></span>');
					btn.attr('disabled', 'disabled');
				}
			}
		);
	});
	$('#exception_red').on('click', function() {
		hide_exception_dialog();
		uiu.make_player_pick(state, state._('exceptions:dialog:red-card'), 'red-card', ui_show_exception_dialog);
	});
	$('#exception_injury').on('click', function() {
		hide_exception_dialog();
		uiu.make_player_pick(state, state._('exceptions:dialog:injury'), 'injury', ui_show_exception_dialog);
	});
	$('#exception_retired').on('click', function() {
		hide_exception_dialog();
		uiu.make_player_pick(state, state._('exceptions:dialog:retired'), 'retired', ui_show_exception_dialog);
	});
	$('#exception_black').on('click', function() {
		hide_exception_dialog();
		uiu.make_player_pick(state, state._('exceptions:dialog:black-card'), 'disqualified', ui_show_exception_dialog);
	});
}

function init_shortcuts() {
	Mousetrap.bind('x', function() {
		if (state.initialized) {
			ui_show_exception_dialog();
		}
	});
	Mousetrap.bind('s', function() {
		if (state.initialized) {
			settings.show();
		}
	});
	Mousetrap.bind('e', function() {
		if (state.initialized) {
			editmode.enter();
		}
	});
	Mousetrap.bind('shift+s', function() {
		scoresheet.show();
	});
	Mousetrap.bind('shift+e', function() {
		i18n.ui_update_state(state, 'en');
	});
	Mousetrap.bind('shift+d', function() {
		i18n.ui_update_state(state, 'de');
	});
}

function set_current(s) {
	buphistory.record(s);

	var title = '';
	if (s.initialized) {
		if (s.setup.match_name) {
			title += s.setup.match_name + ' - ';
		}
		if (state.setup.is_doubles) {
			title += state.setup.teams[0].players[0].name + ' / ' + state.setup.teams[0].players[1].name + ' vs ' + state.setup.teams[1].players[0].name + ' / ' + state.setup.teams[1].players[1].name;
		} else {
			title += state.setup.teams[0].players[0].name + ' vs ' + state.setup.teams[1].players[0].name;
		}
		title += ' - ';
	}
	title += 'Badminton Umpire Panel';
	document.title = title;
}

function ui_init() {
	init_buttons();
	init_shortcuts();
}

function ui_show_exception_dialog() {
	install_destructor(state, hide_exception_dialog);
	render.exception_dialog(state);
	$('#exception_wrapper').show();
	uiu.esc_stack_push(function() {
		hide_exception_dialog();
	});
}

function hide_exception_dialog() {
	uninstall_destructor(state, hide_exception_dialog);
	uiu.esc_stack_pop();
	$('#exception_wrapper').hide();
}


return {
	on_press: on_press,
	on_presses_change: on_presses_change,
	demo_match_start: demo_match_start,
	start_match: start_match,
	resume_match: resume_match,
	ui_init: ui_init,
	hide_exception_dialog: hide_exception_dialog,
	stop_match: stop_match,
	install_destructor: install_destructor,
	uninstall_destructor: uninstall_destructor,
	set_current: set_current,
};

})();

/*@DEV*/
if ((typeof module !== 'undefined') && (typeof require !== 'undefined')) {
	var i18n = require('./i18n');
	var uiu = require('./uiu');
	var network = require('./network');
	var render = require('./render');
	var calc = require('./calc');
	var match_storage = require('./match_storage');
	var editmode = require('./editmode');
	var timer = require('./timer');
	var buphistory = require('./buphistory');

	module.exports = control;
}
/*/@DEV*/
