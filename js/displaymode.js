'use strict';
var displaymode = (function() {

var ALL_STYLES = [
	'oncourt',
	'international',
	'2court',
	'top+list',
	'castall',
	'tournament_overview',
	'andre',
];
var ALL_COLORS = ['c0', 'c1', 'cbg', 'cfg', 'cbg2', 'cbg3', 'cfg2', 'ct', 'cserv', 'crecv', 'cborder'];

function _setup_autosize(el, right_node, determine_height) {
	autosize.maintain(el, function() {
		var parent_node = el.parentNode;
		var w = parent_node.offsetWidth;
		if (right_node) {
			w = Math.min(w, right_node.offsetLeft);
		}

		var h;
		if (determine_height) {
			h = determine_height(parent_node);
		} else {
			h = parent_node.offsetHeight / 1.1;
		}

		return {
			width: w,
			height: h,
		};
	});
}

function _calc_matchscore(matches) {
	var res = [0, 0];
	matches.forEach(function(m) {
		var winner = calc.match_winner(m.setup.counting, m.network_score || []);
		if (winner === 'left') {
			res[0] += 1;
		} else if (winner === 'right') {
			res[1] += 1;
		}
	});
	return res;
}

function _doubles_name(player) {
	if (player.lastname) {
		return player.firstname[0] + '.\xa0' + player.lastname;
	}
	
	var m = /^(.).*?\s+(\S+)$/.exec(player.name);
	if (!m) {
		return player.name;
	}
	return m[1] + '.\xa0' + m[2];
}

function _list_render_player_names(container, players, winning) {
	var names_str;
	if (players.length === 0) {
		names_str = 'TBA';
	} else if (players.length === 1) {
		names_str = players[0].name;
	} else {
		names_str = _doubles_name(players[0]) + ' / ' + _doubles_name(players[1]);
	}
	var div = uiu.el(
		container, 'div', {
			'class': 'display_list_player_names_wrapper',
		}
	);
	var span = uiu.el(
		div, 'span', {
			'class': (winning ? 'display_list_winning' : ''),
		}, names_str
	);
	_setup_autosize(span);
}

function _list_render_team_name(tr, team_name) {
	var th = uiu.el(tr, 'th', {
		'class': 'display_list_teamname',
	});
	var div = uiu.el(th, 'div');
	var span = uiu.el(div, 'span', {}, team_name);
	return span;
}

function _calc_max_games(event) {
	var res = 0;
	event.matches.forEach(function(match) {
		res = Math.max(res, calc.max_game_count(match.setup.counting));
	});
	return res;
}

function hash(settings, event) {
	return {
		style: settings.displaymode_style,
		colors: calc_colors(settings, event),
		scale: settings.d_scale,
		court_id: settings.displaymode_court_id,
		reverse_order: settings.displaymode_reverse_order,
		courts: utils.deep_copy(event.courts),
		matches: utils.deep_copy(event.matches),
	};
}

function determine_server(match, current_score) {
	var team_id;
	if (typeof match.network_team1_serving === 'boolean') {
		team_id = match.network_team1_serving ? 0 : 1;
	}
	if (!match.network_teams_player1_even) {
		return {
			team_id: team_id,
		}; // This ensures that server.player_id is undefined
	}

	var player_id = 0;
	if (match.setup.is_doubles) {
		player_id = (match.network_teams_player1_even[team_id] == (current_score[team_id] % 2 == 0)) ? 0 : 1;
	}

	return {
		team_id: team_id,
		player_id: player_id,
	};
}

function _match_by_court(event, court) {
	return court.match_id ? utils.find(event.matches, function(m) {
		return court.match_id === m.setup.match_id;
	}) : null;
}

function _render_court_display(container, event, court, top_team_idx) {
	var match = _match_by_court(event, court);
	if (top_team_idx === undefined) {
		top_team_idx = 0;
		if (match && court.chair) {
			var team0_left = network.calc_team0_left(match);
			if (typeof team0_left == 'boolean') {
				top_team_idx = (team0_left == (court.chair === 'west')) ? 0 : 1;
			}
		}
	}
	var bottom_team_idx = 1 - top_team_idx;

	var team_names = event.team_names || [];
	var nscore = (match && match.network_score) ? match.network_score : [];
	var match_setup = match ? match.setup : {
		teams: [{
			name: team_names[0],
			players: [],
		}, {
			name: team_names[1],
			players: [],
		}],
	};
	var prev_scores = nscore.slice(0, -1);
	var current_score = (nscore.length > 0) ? nscore[nscore.length - 1] : ['', ''];

	var top_current_score = uiu.el(container, 'div', {
		'class': 'dcs_current_score_top',
	}, current_score[top_team_idx]);
	var bottom_current_score = uiu.el(container, 'div', {
		'class': 'dcs_current_score_bottom',
	}, current_score[bottom_team_idx]);

	var top_team = match_setup.teams[top_team_idx];

	var player_container = uiu.el(container, 'div', {
		'class': (match_setup.is_doubles ? 'dcs_player_names_doubles' : 'dcs_player_names_singles'),
	});
	var server = match ? determine_server(match, current_score) : {};
	for (var player_id = 0;player_id < top_team.players.length;player_id++) {
		var top_is_serving = (top_team_idx === server.team_id) && (player_id === server.player_id);
		var top_player_name_container = uiu.el(player_container, 'div', {
			'class': 'dcs_player_name' + (top_is_serving ? ' dcs_player_serving' : ''),
		});
		var top_player_name_span = uiu.el(
			top_player_name_container, 'span', {}, top_team.players[player_id].name);
		_setup_autosize(top_player_name_span, top_current_score);
	}

	var top_row = uiu.el(container, 'div', {
		'class': 'dcs_team_row dcs_team_row_top',
	});
	var top_prev_scores_container = uiu.el(top_row, 'div', {
		'class': 'dcs_prev_scores_top',
	});
	prev_scores.forEach(function(ps) {
		uiu.el(top_prev_scores_container, 'div', {
			'class': ((ps[top_team_idx] > ps[bottom_team_idx]) ? 'dcs_prev_score_won' : 'dcs_prev_score_lost'),
		}, ps[top_team_idx]);
	});
	var top_team_el = uiu.el(top_row, 'div', {
		'class': 'dcs_team_name',
	});
	var top_team_span = uiu.el(top_team_el, 'span', {}, top_team.name);

	var bottom_row = uiu.el(container, 'div', {
		'class': 'dcs_team_row dcs_team_row_bottom',
	});
	var bottom_prev_scores_container = uiu.el(bottom_row, 'div', {
		'class': 'dcs_prev_scores_bottom',
	});
	prev_scores.forEach(function(ps) {
		uiu.el(bottom_prev_scores_container, 'div', {
			'class': ((ps[bottom_team_idx] > ps[top_team_idx]) ? 'dcs_prev_score_won' : 'dcs_prev_score_lost'),
		}, ps[bottom_team_idx]);
	});
	var bottom_team = match_setup.teams[bottom_team_idx];
	var bottom_team_el = uiu.el(bottom_row, 'div', {
		'class': 'dcs_team_name',
	});
	var bottom_team_span = uiu.el(bottom_team_el, 'span', {}, bottom_team.name);

	player_container = uiu.el(container, 'div', {
		'class': (match_setup.is_doubles ? 'dcs_player_names_doubles' : 'dcs_player_names_singles'),
	});
	for (player_id = 0;player_id < bottom_team.players.length;player_id++) {
		var bottom_is_serving = (bottom_team_idx === server.team_id) && (player_id === server.player_id);
		var bottom_player_name_container = uiu.el(player_container, 'div', {
			'class': 'dcs_player_name' + (bottom_is_serving ? ' dcs_player_serving' : ''),
		});
		var bottom_player_name_span = uiu.el(
			bottom_player_name_container, 'span', {}, bottom_team.players[player_id].name);
		_setup_autosize(bottom_player_name_span, bottom_current_score);
	}

	_setup_autosize(top_team_span);
	_setup_autosize(bottom_team_span);
}

function render_top(s, container, event) {
	if (! event.courts) {
		return;
	}

	var courts_container = uiu.el(container, 'div', {
		'class': 'display_courts_container',
	});
	var court_count = event.courts.length;
	var court_width = Math.floor((100.0 - (4 * (court_count - 1))) / court_count);
	for (var court_idx = 0;court_idx < court_count;court_idx++) {
		if (court_idx > 0) {
			uiu.el(courts_container, 'div', {
				'class': 'display_courts_separator',
			});
		}

		var court_container = uiu.el(courts_container, 'div', {
			'class': 'display_courts_court',
			'style': ('width: ' + court_width + '%;'),
		});

		var real_court_idx = s.settings.displaymode_reverse_order ? (court_count - 1 - court_idx) : court_idx;
		var court = event.courts[real_court_idx];
		_render_court_display(court_container, event, court);
	}
}

function namestr(players) {
	if (players.length === 0) {
		return '(Wird ermittelt)';
	} else if (players.length === 1) {
		return players[0].name;
	} else {
		return _doubles_name(players[0]) + ' / ' + _doubles_name(players[1]);
	}
}

function _match_name(setup) {
	var res = '';
	if (setup.event_name) {
		res += setup.event_name;
	}
	if (setup.match_name) {
		if (res) {
			res += ' ';
		}
		res += setup.match_name;
	}
	return res;
}

function _tournament_overview_render_players(tr, players) {
	var td = uiu.el(tr, 'td', 'd_to_team');
	uiu.el(td, 'span', {}, namestr(players));
}

function render_tournament_overview(s, container, event) {
	var max_game_count = _calc_max_games(event);
	var colors = calc_colors(s.settings, event);

	var table = uiu.el(container, 'table', 'd_to_table');
	var tbody = uiu.el(table, 'tbody');

	event.courts.forEach(function(court, idx) {
		var match = _match_by_court(event, court);
		var nscore = (match ? match.network_score : 0) || [];

		var tr = uiu.el(tbody, 'tr', {
			style: (
				'background:' + ((idx % 2 === 0) ? colors.bg : colors.bg3) + ';' +
				'color:' + colors.fg + ';'
			),
		});
		uiu.el(tr, 'td', 'd_to_court', court.label || compat.courtnum(court.id));
		if (match) {
			var setup = match.setup;
			uiu.el(tr, 'td', {
				'class': 'd_to_matchname',
				style: (
					'color:' + colors.fg2 + ';'
				),
			}, _match_name(setup));
			_tournament_overview_render_players(tr, setup.teams[0].players);
			_tournament_overview_render_players(tr, setup.teams[1].players);
		} else {
			uiu.el(tr, 'td', {
				colspan: 3,
			});
		}
		for (var game_idx = 0;game_idx < max_game_count;game_idx++) {
			var score_td = uiu.el(tr, 'td', {
				'class': 'd_to_score',
				style: 'border-color:' + colors.border,
			});

			var n = nscore[game_idx];
			if (match && n) {
				var gwinner = calc.game_winner(match.setup.counting, game_idx, n[0], n[1]);
				uiu.el(score_td, 'span', {
					'class': ((gwinner === 'left') ? 'd_to_winning' : ''),
				}, n[0]);
				uiu.el(score_td, 'span', {
					'class': 't_to_vs',
				}, ':');
				uiu.el(score_td, 'span', {
					'class': ((gwinner === 'right') ? 'd_to_winning' : ''),
				}, n[1]);
			}
		}
	});
}

function render_castall(s, container, event) {
	if (! event.courts) {
		uiu.el(container, 'div', 'error', s._('displaymode:no courts'));
		return;
	}
	var colors = calc_colors(s.settings, event);
	var scale = s.settings.d_scale / 100;

	uiu.el(container, 'div', {
		'class': 'd_castall_bg',
		'style': ('background: ' + colors.t),
	});

	var abbrevs = extradata.abbrevs(event);
	var logo_url = extradata.logo_url(event);
	var court_count = event.courts.length;
	for (var court_idx = 0;court_idx < court_count;court_idx++) {
		var real_court_idx = s.settings.displaymode_reverse_order ? (court_count - 1 - court_idx) : court_idx;
		var court = event.courts[real_court_idx];
		var match = _match_by_court(event, court);
		var counting = match ? match.setup.counting : eventutils.default_counting(event.league_key);
		var max_games = counting ? calc.max_game_count(counting) : 0;
		var nscore = (match ? match.network_score : 0) || [];

		var match_container = uiu.el(container, 'div', {
			'class': 'd_castall_match',
			'style': (
				((court_idx === 0) ? 'left' : 'right') + ':3%;' +
				'background:' + colors.bg + ';' +
				'width:' + ((85 + (max_games * 41) + (logo_url ? 90 : 0)) * scale) + 'px;' +
				'height:' + (60 * scale) + 'px;' +
				'border-radius:' + (6 * scale) + 'px'),
		});

		var mname_container = uiu.el(match_container, 'div', {
			'class': 'd_castall_mname',
			'style': ('margin:0 ' + (3 * scale) + 'px;font-size:' + (15 * scale) + 'px;width:' + (15 * scale) + 'px'),
		});
		var mname = match ? match.setup.match_name.split(/(?=[^.])/) : '';
		for (var i = 0;i < mname.length;i++) {
			uiu.el(mname_container, 'span', {}, mname[i] || '');
		}

		var teams_container = uiu.el(match_container, 'div', 'd_castall_teams');
		abbrevs.forEach(function(abbrev, team_id) {
			var team_block = uiu.el(teams_container, 'div', {
				'class': 'd_castall_team',
				style: (
					'height:' + (28.5 * scale) + 'px;' +
					'padding-top:' + (1 * scale) + 'px;' +
					((team_id === 1) ? 'padding-bottom:' + (1 * scale) + 'px': '')
				),
			});
			var fg_color = utils.contrast_color(colors[team_id], colors.bg, colors.fg);
			var team_name_container = uiu.el(team_block, 'div', {
				style: (
					'font-family: monospace;' +
					'background:' + colors[team_id] + ';' +
					'color:' + fg_color + ';' +
					'width:' + (45 * scale) + 'px;' +
					'height: 100%;' +
					'display: flex;' +
					'justify-content: center;' +
					'align-items: center;' +
					'font-size:' + (22 * scale) + 'px;'),
			});
			uiu.el(team_name_container, 'span', {}, abbrev);

			uiu.el(team_block, 'div', {
				style: (
					'height: 100%;' +
					'background:' + ((match && (match.network_team1_serving == (team_id === 0))) ? colors.serv : colors.recv) + ';' +	
					'margin:0 ' + (1 * scale) + 'px;' +
					'width:' + (10 * scale) + 'px;'),
			});

			for (var game_idx = 0;game_idx < max_games;game_idx++) {
				var score_container = uiu.el(team_block, 'div', {
					style: (
						'background:' + colors.bg2 + ';' +
						'color:' + colors.bg + ';' +
						'width:' + (40 * scale) + 'px;' +
						'margin-right: ' + (1 * scale) + 'px;' +
						'height: 100%;' +
						'display: flex;' +
						'justify-content: center;' +
						'align-items: center;' +
						'font-size:' + (22 * scale) + 'px;'),
				});
				uiu.el(score_container, 'span', {}, nscore[game_idx] ? nscore[game_idx][team_id] : '');
			}
		});

		if (logo_url) {
			uiu.el(match_container, 'div', {
				style: (
					'height:' + (50 * scale) + 'px;' +
					'margin:' + (5 * scale) + 'px 0;' +
					'width:' + (90 * scale) + 'px;' +
					'float: left;' +
					'background: no-repeat center/contain url("' + logo_url + '");'
				),
			});
		}
	}

	// Bottom display
	var match_score = _calc_matchscore(event.matches);
	var bottom_container = uiu.el(container, 'div', 'd_castall_bottom');
	var bottom_block = uiu.el(bottom_container, 'div', {
		'class': 'd_castall_bottom_block',
		'style': (
			'background:' + colors.bg + ';' +
			'width:' + (670 * scale) + 'px;' +
			'height:' + (55 * scale) + 'px;' + 
			'border-radius:' + (12 * scale) + 'px'),
	});
	var team_names = event.team_names || [];
	for (var team_id = 0;team_id < team_names.length;team_id++) {
		var team_block = uiu.el(bottom_block, 'div', {
			'class': 'd_castall_bottom_team' + team_id,
			'style': (
				'width:' + (262 * scale) + 'px;' +
				'font-size:' + (32 * scale) + 'px;' +
				((team_id === 0) ? 'margin-left' : 'margin-right') + ':' + (8 * scale) + 'px'
			),
		});
		var team_name_span = uiu.el(team_block, 'span', {
			'class': 'd_castall_bottom_team_name',
			'style': 'color: ' + colors.fg,
		}, team_names[team_id]);
		_setup_autosize(team_name_span);

		var bottom_fg_color = utils.contrast_color(colors[team_id], colors.bg, colors.fg);
		uiu.el(bottom_block, 'div', {
			'class': 'd_castall_score' + team_id,
			'style': (
				'height:' + (54 * scale) + 'px;' +
				'margin-bottom:' + (1 * scale) + 'px;' +
				'color:' + bottom_fg_color + ';' +
				'background: ' + colors[team_id] + ';' +
				'width:' + (65 * scale) + 'px;' +
				'font-size:' + (60 * scale) + 'px'),
		}, match_score[team_id]);
	}

	var colon_container = uiu.el(bottom_container, 'div', {
		'class': 'd_castall_bcolon',
	});
	uiu.el(colon_container, 'div', {
		'style': 'font-size:' + (50 * scale) + 'px; margin-top: -0.1em;',
	}, ':');

	if (logo_url) {
		var logo_row = uiu.el(bottom_block, 'div', {
			style: (
				'position: absolute;' +
				'left: 0;' +
				'width: 100%;' +
				'top:-' + (55 * scale) + 'px;' +
				'height:' + (55 * scale) + 'px;' +
				'display: flex;' +
				'justify-content:center;'
			),
		});
		uiu.el(logo_row, 'div', {
			style: (
				'width: 0; height: 0;' +
				'border-top:' + (53.5 * scale) + 'px solid transparent;' +
				'border-right:' + (20 * scale) + 'px solid ' + colors.bg + ';' +
				'margin-top:' + (1.5 * scale) + 'px;' +
				'margin-right:' + (-1 * scale) + 'px;'
			),
		});
		var logo_mid = uiu.el(logo_row, 'div', {
			style: (
				'background:' + colors.bg + ';' +
				'border-top-left-radius:' + (5 * scale) + 'px;' +
				'border-top-right-radius:' + (5 * scale) + 'px;' +
				'height:' + (55 * scale) + 'px;' +
				'width:' + (90 * scale) + 'px;'
			),
		});
		uiu.el(logo_mid, 'div', {
			style: (
				'height:' + (45 * scale) + 'px;' +
				'margin-top: ' + (5 * scale) + 'px;' +
				'margin-bottom: ' + (5 * scale) + 'px;' +
				'width:' + (90 * scale) + 'px;' +
				'background: no-repeat center/contain url("' + logo_url + '");'
			),
		});
		uiu.el(logo_row, 'div', {
			style: (
				'width: 0; height: 0;' +
				'border-top:' + (53.5 * scale) + 'px solid transparent;' +
				'border-left:' + (20 * scale) + 'px solid ' + colors.bg + ';' +
				'margin-top:' + (1.5 * scale) + 'px;' +
				'margin-left:' + (-1 * scale) + 'px;'
			),
		});
	}
}


function render_list(container, event) {
	render_html_list(container, event); // TODO switch to svg
}

function render_html_list(container, event) {
	var max_games = _calc_max_games(event);
	var match_score = _calc_matchscore(event.matches);
	var home_winning = match_score[0] > (event.matches.length / 2);
	var away_winning = match_score[1] > (event.matches.length / 2);
	if ((match_score[0] === event.matches.length / 2) && (match_score[0] === event.matches.length / 2)) {
		// draw
		home_winning = true;
		away_winning = true;
	}
	var match_list = uiu.el(container, 'table', {
		'class': 'display_list_container',
	});
	var match_list_head = uiu.el(match_list, 'tr', {
		'class': 'display_list_thead',
	});
	uiu.el(match_list_head, 'th', {
		'class': 'display_list_match_name',
	}, '');
	var team_names = event.team_names || [];
	var home_span = _list_render_team_name(match_list_head, team_names[0]);
	var away_span = _list_render_team_name(match_list_head, team_names[1]);
	var match_score_el = uiu.el(match_list_head, 'th', {
		'class': 'display_list_matchscore',
		'colspan': max_games,
	});
	uiu.el(match_score_el, 'span', {
		'class': (home_winning ? 'display_list_winning' : ''),
	}, match_score[0]);
	uiu.el(match_score_el, 'span', {'class': 'display_list_vs'}, ' : ');
	uiu.el(match_score_el, 'span', {
		'class': (away_winning ? 'display_list_winning' : ''),
	}, match_score[1]);

	// Now that we're done with initializing the first row, actually call autosizing
	_setup_autosize(home_span);
	_setup_autosize(away_span);

	event.matches.forEach(function(m) {
		var netscore = m.network_score || [];
		var mwinner = calc.match_winner(m.setup.counting, netscore);

		var row = uiu.el(match_list, 'tr');
		uiu.el(row, 'td', {
			'class': 'display_list_match_name',
		}, m.setup.short_name || m.setup.match_name);
		var home_td = uiu.el(row, 'td', {
			'class': 'display_list_player_names' + ((mwinner === 'left') ? ' display_list_winning_players' : ''),
		});
		_list_render_player_names(home_td, m.setup.teams[0].players, (mwinner === 'left'));
		var away_td = uiu.el(row, 'td', {
			'class': 'display_list_player_names' + ((mwinner === 'right') ? ' display_list_winning_players' : ''),
		});
		_list_render_player_names(away_td, m.setup.teams[1].players, (mwinner === 'right'));

		for (var game_idx = 0;game_idx < max_games;game_idx++) {
			var score_td = uiu.el(row, 'td', {
				'class': 'display_list_game_score',
			});

			if (game_idx >= netscore.length) {
				continue;
			}
			var nscore = netscore[game_idx];
			var gwinner = calc.game_winner(m.setup.counting, game_idx, nscore[0], nscore[1]);
			uiu.el(score_td, 'span', {
				'class': ((gwinner === 'left') ? 'display_list_winning' : ''),
			}, nscore[0]);
			uiu.el(score_td, 'span', {
				'class': 'display_list_vs',
			}, ':');
			uiu.el(score_td, 'span', {
				'class': ((gwinner === 'right') ? 'display_list_winning' : ''),
			}, nscore[1]);
		}
	});
}

function render_oncourt(s, container, event, court) {
	var oncourt_container = uiu.el(container, 'div', {
		'class': 'd_oncourt',
	});
	_render_court_display(oncourt_container, event, court, 0);
}

function _gamescore_from_netscore(netscore, setup) {
	var gscores = [0, 0];
	netscore.forEach(function(gs, game_idx) {
		var winner = calc.game_winner(setup.counting, game_idx, gs[0], gs[1]);
		if (winner == 'left') {
			gscores[0]++;
		} else if (winner == 'right') {
			gscores[1]++;
		}
	});
	return gscores;
}

function render_andre(s, container, event, court, match, colors) {
	var nscore = match.network_score || [];
	var gscore = _gamescore_from_netscore(nscore, match.setup);
	var is_doubles = match.setup.is_doubles;
	var pcount = is_doubles ? 2 : 1;
	var current_score = nscore[nscore.length - 1] || [];
	var server = determine_server(match, current_score);

	match.setup.teams.forEach(function(team, team_id) {
		var gwinner = calc.game_winner(match.setup.counting, nscore.length - 1, current_score[0], current_score[1]);
		var team_serving = (
			(gwinner === 'left') ? (team_id === 0) : (
			(gwinner === 'right') ? (team_id === 1) : (
			(server.team_id === team_id))));
		var points = current_score[team_id];

		var player_names = team.players.map(function(player) {
			return player.name;
		});
		while (player_names.length < pcount) {
			player_names.push('');
		}

		var team_container = uiu.el(container, 'div', {
			'class': 'd_andre_team',
			style: (
				'background:' + colors.bg + ';' +
				'color:' + colors.fg + ';'
			),
		});

		if (compat.is_samsung()) {
			var table = uiu.el(team_container, 'table', {
				style: 'height: 45vh; width: 100vw; min-width: 95vw;',
			});
			var tbody = uiu.el(table, 'tbody');

			var tr1 = uiu.el(tbody, 'tr');
			var tr2 = uiu.el(tbody, 'tr');
			var trs = [tr1, tr2];

			uiu.el(tr1, 'td', {
				rowspan: 2,
				style: 'font-size: 10vh; vertical-align: middle;',
			}, gscore[team_id]);

			var is_singles = (player_names.length < 2);
			player_names.forEach(function(pn, name_idx) {
				var ptd = uiu.el(trs[name_idx], 'td', {
					rowspan: (is_singles ? 2 : 1),
					style: 'vertical-align: middle; font-size: 80px;',
				});
				uiu.el(ptd, 'span', {}, pn);
			});

			uiu.el(tr1, 'td', {
				rowspan: 2,
				style: (
					'width: 50vh;' +
					'background:' + (team_serving ? colors.fg : colors.bg) + ';' +
					'color:' + (team_serving ? colors.bg : colors.fg) + ';' +
					'text-align: center;' +
					'font-size: 40vh;'
				),
			}, points);

			if (team_id === 0) {
				uiu.el(container, 'div', {
					'class': 'd_andre_mid',
					'style': (
						'color:' + colors.fg2 + ';'
					),
				}, _match_name(match.setup));
			}
			return;
		}
		uiu.el(team_container, 'div', 'd_andre_gscore', gscore[team_id]);

		var players_container = uiu.el(team_container, 'div', 'd_andre_players');
		var player_spans = player_names.map(function(pname) {
			var pel = uiu.el(players_container, 'div', {
				'class': 'd_andre_player',
				style: (
					'height:' + (is_doubles ? '50%' : '100%') + ';'
				),
			});
			return uiu.el(pel, 'span', {}, pname);
		});

		var score_el = uiu.el(team_container, 'div', {
			'class': 'd_andre_score',
			style: (
				'background:' + (team_serving ? colors.fg : colors.bg) + ';' +
				'color:' + (team_serving ? colors.bg : colors.fg) + ';' +
				((team_id === 0) ? 'top' : 'bottom') + ': 0;'
			),
		}, points);

		if (team_id === 0) {
			uiu.el(container, 'div', {
				'class': 'd_andre_mid',
				'style': (
					'color:' + colors.fg2 + ';'
				),
			}, _match_name(match.setup));
		}

		player_spans.forEach(function(ps) {
			_setup_autosize(ps, score_el, function(parent_node) {
				return parent_node.offsetHeight * 0.6;
			});
		});
	});
}

function render_international(s, container, event, court) {
	var match = _match_by_court(event, court);
	if (!match) {
		return;
	}

	var nscore = match.network_score || [];
	var gscore = _gamescore_from_netscore(nscore, match.setup);
	var colors = calc_colors(s.settings, event);
	var is_doubles = match.setup.is_doubles;
	var pcount = is_doubles ? 2 : 1;
	var current_score = nscore[nscore.length - 1] || [];
	var server = determine_server(match, current_score);
	var first_game = (nscore.length < 2);
	var mwinner = calc.match_winner(match.setup.counting, nscore);
	var match_over = (mwinner === 'left') || (mwinner === 'right');

	match.setup.teams.forEach(function(team, team_id) {
		var col = colors[team_id];
		var gwinner = calc.game_winner(match.setup.counting, nscore.length - 1, current_score[0], current_score[1]);
		var team_serving = (
			(gwinner === 'left') ? (team_id === 0) : (
			(gwinner === 'right') ? (team_id === 1) : (
			(server.team_id === team_id))));

		var player_names = team.players.map(function(player) {
			return player.name;
		});
		while (player_names.length < pcount) {
			player_names.push('');
		}

		var team_container = uiu.el(container, 'div', 'd_international_team');
		var player_spans = player_names.map(function(pname, player_id) {
			var is_server = (!match_over) && team_serving && (server.player_id === player_id);
			var style = (
				'background: ' + (is_server ? col : colors.bg) + ';' +
				'color: ' + (is_server ? colors.bg : col) + ';' +
				'height: ' + (is_doubles ? '100%' : '50%') + ';'
			);

			var player_container = uiu.el(team_container, 'div', {
				'style': 'height: ' + (is_doubles ? '50%' : '100%') + ';',
				'class': 'd_international_player_container',
			});
			var pel = uiu.el(player_container, 'div', {
				style: style,
				'class': 'd_international_player',
			});
			return uiu.el(pel, 'div', {}, pname);
		});

		var right_border;
		if (! first_game) {
			right_border = uiu.el(team_container, 'div', {
				'class': 'd_international_gscore',
				style: 'background: ' + colors.bg + '; color: ' + colors.fg + ';',
			}, gscore[team_id]);
		}

		var points = current_score[team_id];
		var points_el = uiu.el(team_container, 'div', {
			'class': 'd_international_score' + ((points >= 10) ? ' d_international_score_dd' : ''),
			style: 'background: ' + (team_serving ? col : colors.bg) + '; color: ' + (team_serving ? colors.bg : col),
		}, points);
		if (!right_border) {
			right_border = points_el;
		}

		player_spans.forEach(function(ps) {
			_setup_autosize(ps, right_border, function(parent_node) {
				return parent_node.offsetHeight * 0.5;
			});
		});
	});
}

function _render_court(s, container, event) {
	if (!event.courts) {
		uiu.el(container, 'div', {
			'class': 'display_error',
		}, 'Court information missing');
		return;
	}

	var cid = s.settings.displaymode_court_id;
	var court;
	for (var i = 0;i < event.courts.length;i++) {
		var c = event.courts[i];
		if (c.court_id == cid) {
			court = c;
			break;
		}
	}
	if (!court) {
		uiu.el(container, 'div', {
			'class': 'display_error',
		}, 'Court ' + JSON.stringify(cid) + ' not found');
		return;
	}

	return court;
}

function calc_team_colors(event, settings) {
	if (event.team_colors) {
		return event.team_colors;
	}
	if (event.team_names) {
		return event.team_names.map(function(tn, team_idx) {
			return extradata.get_color(tn) || settings['d_c' + team_idx];
		});
	}
	return [
		settings.d_c0,
		settings.d_c1,
	];
}

function calc_colors(cur_settings) {
	var res = {};
	ALL_COLORS.forEach(function(k) {
		var ek = 'd_' + k;
		res[k.substr(1)] = cur_settings[ek] || settings.default_settings[ek];
	});
	return res;
}

function _extract_timer_state(s, match) {
	if (s.settings.displaymode_style !== '2court') {
		return; // No timer required
	}

	var presses = eventutils.get_presses(match);
	var rs = calc.remote_state(s, match.setup, presses);
	return rs;
}

var active_timers = [];
function create_timer(timer_state, parent, props) {
	var tv = timer.calc(timer_state);
	if (!tv.visible || tv.upwards) {
		return;
	}
	var el = uiu.el(parent, 'div', props, tv.str);
	var tobj = {};
	active_timers.push(tobj);

	var update = function() {
		var tv = timer.calc(timer_state);
		var visible = tv.visible && !tv.upwards;
		uiu.text(el, tv.str);
		if (visible && tv.next) {
			tobj.timeout = setTimeout(update, tv.next);
		} else {
			tobj.timeout = null;
		}
		if (!visible) {
			uiu.remove(el);
		}
	};
	update();
}

function abort_timers() {
	active_timers.forEach(function(tobj) {
		if (tobj.timeout) {
			clearTimeout(tobj.timeout);
		}
	});
}

function render_2court(s, container, event) {
	if (!event.courts) {
		uiu.el(container, 'div', {
			'class': 'display_error',
		}, 'Court information missing');
		return;
	}

	var colors = calc_colors(s.settings, event);

	uiu.el(container, 'div', {
		'class': 'd_2court_divider',
		'style': 'background: ' + colors.bg2,
	});
	var team_names = event.team_names || [];
	team_names.forEach(function(team_name, team_idx) {
		var teamname_container = uiu.el(container, 'div', {
			'class': 'd_2court_teamname' + team_idx,
			style: 'background: ' + colors.bg + '; color: ' + colors[team_idx] + ';',
		});
		var teamname_span = uiu.el(teamname_container, 'span', {}, team_name);
		_setup_autosize(teamname_span);
	});

	for (var court_idx = 0;court_idx < 2;court_idx++) {
		var court_container = uiu.el(container, 'div', 'd_2court_side' + court_idx);

		var real_court_idx = s.settings.displaymode_reverse_order ? (1 - court_idx) : court_idx;
		var court = event.courts[real_court_idx];
		var match = _match_by_court(event, court);

		if (!match) {
			// TODO: test and improve handling when no match is on court
			continue;
		}
		var nscore = match.network_score || [];
		var gscore = _gamescore_from_netscore(nscore, match.setup);
		var current_score = nscore[nscore.length - 1] || [];
		var server = determine_server(match, current_score);
		var gwinner = calc.game_winner(match.setup.counting, nscore.length - 1, current_score[0], current_score[1]);

		match.setup.teams.forEach(function(team, team_id) {
			var team_container = uiu.el(court_container, 'div', 'd_2court_team' + team_id);

			var col = colors[team_id];
			var team_serving = (
				(gwinner === 'left') ? (team_id === 0) : (
				(gwinner === 'right') ? (team_id === 1) : (
				(server.team_id === team_id))));

			var points = (current_score[team_id] === undefined) ? '' : ('' + current_score[team_id]);
			var score_el = uiu.el(team_container, 'div', {
				'class': 'd_2court_score',
				style: 'background: ' + (team_serving ? col : colors.bg) + '; color: ' + (team_serving ? colors.bg : col),
			});
			if (points.length < 2) {
				uiu.text(score_el, points);
			} else {
				// Two digits, layout manually since we're extremely tight on space
				utils.forEach(points, function(digit, digit_idx) {
					uiu.el(score_el, 'div', 'd_2court_score_digit' + digit_idx, digit);
				});
			}

			uiu.el(team_container, 'div', {
				'class': 'd_2court_gscore',
				style: 'background: ' + colors.bg + '; color: ' + colors.fg + ';',
			}, gscore[team_id]);
		});

		uiu.el(court_container, 'div', 'd_2court_info', match.setup.match_name);

		var timer_state = _extract_timer_state(s, match);
		if (timer_state) {
			create_timer(timer_state, court_container, {
				'class': 'd_2court_timer',
				style: 'background: ' + colors.bg + '; color: ' + colors.fg + ';',
			});
		}
	}
}

function on_color_select(e) {
	var el = e.target;
	var new_settings = {};
	new_settings['d_' + el.getAttribute('data-name')] = el.value;
	settings.change_all(state, new_settings);
}

var _last_painted_hash = null;
var _last_err;
function update(err, s, event) {
	_last_err = err;

	var container = uiu.qs('.displaymode_layout');
	uiu.remove_qsa('.display_loading,.display_error', container);

	var style = s.settings.displaymode_style;

	if (err && (err.errtype === 'loading')) {
		uiu.el(container, 'div', {
			'class': 'display_loading',
		});
		return;
	}

	if (err) {
		uiu.el(container, 'div', {
			'class': 'display_error',
		}, err.msg);
		// TODO consider whether reenabling the following
		// report_problem.silent_error('network error in display mode: ' + err.msg);
		return;
	}

	// Also update general state
	network.update_event(s, event);

	// If nothing has changed we can skip painting
	var cur_event_hash = hash(s.settings, event);
	if (utils.deep_equal(cur_event_hash, _last_painted_hash)) {
		return;
	}

	var court_select = uiu.qs('[name="displaymode_court_id"]');
	uiu.visible_qs('.settings_display_court_id', option_applies(style, 'court_id'));
	uiu.visible_qs('.settings_display_reverse_order', option_applies(style, 'reverse_order'));
	uiu.visible_qs('.settings_d_scale', option_applies(style, 'scale'));
	uiu.visible_qs('.settings_d_team_colors',
		option_applies(style, 'c0') &&
		!utils.deep_equal(
			calc_team_colors(event, s.settings),
			[s.settings.d_c0, s.settings.d_c1]));
	if (event.courts && (!_last_painted_hash || !utils.deep_equal(cur_event_hash.courts, _last_painted_hash.courts))) {
		uiu.empty(court_select);
		event.courts.forEach(function(c) {
			var attrs = {
				value: c.court_id,
			};
			if (s.settings.displaymode_court_id == c.court_id) {
				attrs['selected'] = 'selected';
			}
			uiu.el(court_select, 'option', attrs, c.label || c.description || c.court_id);
		});
	}

	var used_colors = active_colors(style);
	uiu.visible_qs('.settings_d_colors', used_colors.length > 0);
	var color_inputs = uiu.qs('.settings_d_colors_inputs');
	if (color_inputs.getAttribute('data-json') !== JSON.stringify(used_colors)) {
		uiu.empty(color_inputs);
		used_colors.forEach(function(uc) {
			var color_input = uiu.el(color_inputs, 'input', {
				type: 'color',
				'data-name': uc, // Not name to prevent it being found by general attaching of event handlers
				title: uc,
				value: s.settings['d_' + uc],
			});
			color_input.addEventListener('change', on_color_select);
		});
	}

	// Redraw everything
	abort_timers();
	autosize.unmaintain_all(container);
	uiu.empty(container);

	ALL_STYLES.forEach(function(astyle) {
		((astyle === style) ? uiu.addClass : uiu.removeClass)(container, 'd_layout_' + astyle);
	});

	if (! event.courts) {
		uiu.el(container, 'div', 'error', s._('displaymode:no courts'));
		return;
	}

	var xfunc = {
		andre: render_andre,
	}[style];
	if (xfunc) {
		var court = _render_court(s, container, event);
		if (!court) {
			return;
		}

		var colors = calc_colors(s.settings, event);
		var match = _match_by_court(event, court);
		if (!match) {
			var nomatch_el = uiu.el(container, 'div', {
				'class': 'd_nomatch',
				style: (
					'color:' + colors.fg2
				),
			});
			var tname = event.team_competition ? event.event_name : event.tournament_name;
			if (tname) {
				uiu.el(nomatch_el, 'div', {
					style: (
						'font-size:' + (event.team_competition ? '7vmin' : '18vmin') + ';'
					),
				}, tname);
			}
			uiu.el(nomatch_el, 'div', {
				style: (
					'font-size:' + (event.team_competition ? '10vmin' : '18vmin') + ';'
				),
			}, s._('Court') + ' ' + (court.label || court.num || court.court_id));
			return;
		}

		xfunc(s, container, event, court, match, colors);
		return;
	}

	var func = {
		'oncourt': render_oncourt,
		'international': render_international,
	}[style];
	if (func) {
		var court2 = _render_court(s, container, event);
		if (court2) {
			func(s, container, event, court2);
		}
	} else {
		switch (style) {
		case '2court':
			render_2court(s, container, event);
			break;
		case 'castall':
			render_castall(s, container, event);
			break;
		case 'tournament_overview':
			render_tournament_overview(s, container, event);
			break;
		case 'top+list':
		default:
			render_top(s, container, event);
			render_list(container, event);
		}
	}

	_last_painted_hash = cur_event_hash;
}

function on_style_change(s) {
	update(_last_err, s, s.event);
}

var _cancel_updates = null;
function show() {
	if (state.ui.displaymode_visible) {
		return;
	}

	state.ui.displaymode_visible = true;
	refmode_referee_ui.hide();
	render.hide();
	settings.hide(true, true);
	settings.on_mode_change(state);
	settings.show_displaymode();

	control.set_current(state);
	uiu.show_qs('.displaymode_layout');
	uiu.addClass_qs('.settings_layout', 'settings_layout_displaymode');

	update({
		errtype: 'loading',
	}, state);

	_cancel_updates = network.subscribe(state, update, function(s) {
		return s.settings.displaymode_update_interval;
	});
}

function hide() {
	if (! state.ui.displaymode_visible) {
		return;
	}

	settings.hide_displaymode();
	if (_cancel_updates) {
		_cancel_updates();
	}

	var container = uiu.qs('.displaymode_layout');
	autosize.unmaintain_all(container);
	uiu.empty(container);
	uiu.hide(container);
	_last_painted_hash = null;

	uiu.removeClass_qs('.settings_layout', 'settings_layout_displaymode');
	state.ui.displaymode_visible = false;
	settings.on_mode_change(state);
}

function advance_style(s, direction) {
	if (!state.ui.displaymode_visible) {
		return;
	}
	var idx = ALL_STYLES.indexOf(s.settings.displaymode_style) + direction;
	var len = ALL_STYLES.length;
	if (idx >= len) {
		idx -= len;
	}
	if (idx < 0) {
		idx += len;
	}
	s.settings.displaymode_style = ALL_STYLES[idx];
	settings.update(s);
	on_style_change(s);
	settings.store(s);
}

function ui_init(s, hash_query) {
	if (hash_query.dm_style !== undefined) {
		s.settings.displaymode_style = hash_query.dm_style;
		settings.update(s);
	}

	var cur_style = s.settings.displaymode_style;
	uiu.qsEach('select[name="displaymode_style"]', function(select) {
		ALL_STYLES.forEach(function(style_id) {
			var i18n_id = 'displaymode:' + style_id;
			var attrs = {
				'data-i18n': i18n_id,
				value: style_id,
			};
			if (style_id === cur_style) {
				attrs.selected = 'selected';
			}
			uiu.el(select, 'option', attrs, s._(i18n_id));
		});
	});

	Mousetrap.bind('left', function() {
		advance_style(s, -1);
	});
	Mousetrap.bind('right', function() {
		advance_style(s, 1);
	});

	click.qs('.displaymode_layout', function() {
		settings.show_displaymode();
	});
	click.qs('.settings_mode_display', function(e) {
		e.preventDefault();
		show();
	});
	click.qs('.settings_d_team_colors', function() {
		var tc = calc_team_colors(state.event, state.settings);
		settings.change_all(state, {
			d_c0: tc[0],
			d_c1: tc[1],
		});
	});
}

function active_colors(style_id) {
	var res = [];
	ALL_COLORS.forEach(function(col) {
		if (option_applies(style_id, col)) {
			res.push(col);
		}
	});
	return res;
}

function option_applies(style_id, option_name) {
	var BY_STYLE = {
		tournament_overview: ['cfg', 'cbg', 'cbg3', 'cborder', 'cfg2'],
		andre: ['court_id', 'cfg', 'cbg', 'cfg2'],
	};
	var bs = BY_STYLE[style_id];
	if (bs) {
		return utils.includes(bs, option_name);
	}

	switch (option_name) {
	case 'c0':
	case 'c1':
	case 'cfg':
	case 'cbg':
		return (
			(style_id === 'international') ||
			(style_id === '2court') ||
			(style_id === 'castall'));
	case 'cbg2':
	case 'ct':
	case 'cserv':
	case 'crecv':
		return (style_id === 'castall');

	case 'court_id':
		return (style_id === 'oncourt') || (style_id === 'international');
	case 'reverse_order':
		return (style_id === 'top+list') || (style_id === '2court') || (style_id === 'castall');
	case 'scale':
		return (style_id === 'castall');
	}
}

return {
	show: show,
	hide: hide,
	ui_init: ui_init,
	on_style_change: on_style_change,
	option_applies: option_applies,
	ALL_STYLES: ALL_STYLES,
	ALL_COLORS: ALL_COLORS,
	calc_team_colors: calc_team_colors,
	// Testing only
	render_castall: render_castall,
};

})();

/*@DEV*/
if ((typeof module !== 'undefined') && (typeof require !== 'undefined')) {
	var autosize = require('./autosize');
	var calc = require('./calc');
	var click = require('./click');
	var control = require('./control');
	var compat = require('./compat');
	var eventutils = require('./eventutils');
	var extradata = require('./extradata');
	var network = require('./network');
	var render = require('./render');
	var refmode_referee_ui = null; // break cycle, should be require('./refmode_referee_ui');
	var settings = require('./settings');
	var timer = require('./timer');
	var uiu = require('./uiu');
	var utils = require('./utils');

	module.exports = displaymode;
}
/*/@DEV*/
