function btde(baseurl) {
'use strict';

function ui_render_login(container) {
	var login_form = $('<form class="settings_login">');
	login_form.append($('<h2>Login badmintonticker</h2>'));
	var login_error = $('<div class="network_error"></div>');
	login_form.append(login_error);
	login_form.append($('<input name="benutzername" type="text" placeholder="Benutzername">'));
	login_form.append($('<input name="passwort" type="password" placeholder="Passwort">'));
	var login_button = $('<button class="login_button"/>');
	login_form.append(login_button);
	var loading_icon = $('<div class="default-invisible loading-icon" />');
	login_button.append(loading_icon);
	login_button.append($('<span>Anmelden</span>'));
	container.append(login_form);
	login_form.on('submit', function(e) {
		e.preventDefault();
		loading_icon.show();
		login_button.attr('disabled', 'disabled');

		network.request('btde.login', {
			dataType: 'text',
			url: baseurl + 'login/index.php',
			method: 'POST',
			data: login_form.serializeArray(),
			contentType: 'application/x-www-form-urlencoded',
			timeout: state.settings.network_timeout,
		}).done(function(res) {
			loading_icon.hide();
			login_button.removeAttr('disabled');

			var m = /<div class="login">\s*<p class="rot">([^<]*)</.exec(res);
			var msg = 'Login fehlgeschlagen';
			if (m) {
				msg = m[1];
			} else if (/<div class="logout">/.exec(res)) {
				// Successful
				network.errstate('all', null);
				return;
			}

			login_error.text(msg);
			network.errstate('btde.login', {
				msg: 'Login fehlgeschlagen',
			});
		}).fail(function(xhr) {
			var code = xhr.status;
			loading_icon.hide();
			login_button.removeAttr('disabled');
			login_error.text('Login fehlgeschlagen (Fehler ' + code + ')');
			network.errstate('btde.login', {
				msg: 'Login fehlgeschlagen (Fehler ' + code + ')',
			});
		});

		return false;
	});
}

function _request(s, component, options, cb) {
	options.dataType = 'text';
	options.timeout = s.settings.network_timeout;
	network.request(component, options).done(function(res) {
		if (/<button>anmelden<\/button>/.exec(res)) {
			return cb({
				type: 'login-required',
				msg: 'Login erforderlich',
			}, res);
		}
		return cb(null, res);
	}).fail(function(xhr) {
		var msg = ((xhr.status === 0) ?
			'badmintonticker nicht erreichbar' :
			('Netzwerk-Fehler (Code ' + xhr.status + ')')
		);
		return cb({
			type: 'network-error',
			status: xhr.status,
			msg: msg,
		});
	});
}

var outstanding_requests = 0;
function send_score(s) {
	if (s.settings.court_id === 'referee') {
		network.errstate('btde.score', null);
		return;
	}

	var netscore = calc.netscore(s, true);

	// badminticker requirements - show 0:0 before match start
	if (netscore.length === 0) {
		netscore = [[0, 0]];
	}

	var post_data = {
		id: s.setup.btde_match_id,
		feld: s.settings.court_id,
	};
	var game_count = calc.max_game_count(s.setup.counting);
	netscore.forEach(function(score, game_idx) {
		post_data['satz' + (game_idx + 1)] = '' + score[0];
		post_data['satz' + (game_count + game_idx + 1)] = '' + score[1];
	});
	for (var i = 1;i <= 2 * game_count;i++) {
		if (post_data['satz' + i] === undefined) {
			post_data['satz' + i] = '';
		}
	}

	if (outstanding_requests > 0) {
		// Another request is currently underway; ours may come to late
		// Send our request anyways, but send it once again as soon as there are no more open requests
		s.remote.btde_resend = true;
	}
	outstanding_requests++;
	var match_id = s.metadata.id;

	_request(s, 'btde.score', {
		method: 'POST',
		url: baseurl + 'login/write.php',
		data: JSON.stringify(post_data),
		contentType: 'application/json; charset=utf-8',
	}, function(err) {
		outstanding_requests--;
		if (!s.metadata || (s.metadata.id !== match_id)) { // Match changed while the request was underway
			return;
		}

		if (!err) {
			s.remote.btde_score = netscore;
			s.remote.btde_court = s.settings.court_id;
		}
		network.errstate('btde.score', err);

		if (s.remote.btde_resend && outstanding_requests === 0) {
			s.remote.btde_resend = false;
			send_score(s);
		}
	});
}

function sync(s) {
	var netscore = calc.netscore(s, true);
	if ((s.settings.court_id != s.remote.btde_court) || !utils.deep_equal(netscore, s.remote.btde_score)) {
		send_score(s);
	}
}

/* s, press */
function send_press(s) {
	if (!s.setup.btde_match_id) {
		// Manual match while badmintonticker is active
		return;
	}
	sync(s);
}

function _parse_player(s) {
	var m = /^([^,]+),\s*([^,]+)$/.exec(s);

	if (m) {
		return {
			firstname: m[2],
			lastname: m[1],
			name: m[2] + ' ' + m[1],
		};
	} else {
		m = /^(\S+)\s(\S+)$/.exec(s);
		if (m) {
			return {
				firstname: m[1],
				lastname: m[2],
				name: m[1] + ' ' + m[2],
			};
		} else {
			return {
				name: s,
			};
		}
	}
}

function _parse_players(s) {
	var m = /^([^~]*)(?:~(.*))?$/.exec(s);
	var res = [];

	if (m) {
		if (m[1]) {
			res.push(_parse_player(m[1]));
		}
		if (m[2]) {
			res.push(_parse_player(m[2]));
		}
	}
	return res;
}

function _parse_match_list(doc, now) {
	var event_data = doc[0];
	var home_team_name = event_data.heim;
	var away_team_name = event_data.gast;

	var league_key = {
		'1. Bundesliga': '1BL-2016',
		'2. Bundesliga Nord': '2BLN-2016',
		'2. Bundesliga Süd': '2BLS-2016',
		'Regionalliga Nord': 'RLN-2016',
	}[event_data.Liga.trim()];
	if (!league_key) {
		league_key = '1BL-2016';
	}

	var used_courts = [{
		court_id: 1,
		description: '1 (links)',
	}, {
		court_id: 2,
		description: '2 (rechts)',
	}];
	var counting = (doc[0].GewS == 2) ? '3x21' : '5x11_15';
	var game_count = calc.max_game_count(counting);

	var matches = doc.slice(1, doc.length).map(function(match) {
		var is_doubles = /HD|DD|GD/.test(match.dis);
		var teams = [{
			players: _parse_players(match.heim),
		}, {
			players: _parse_players(match.gast),
		}];

		// btde always lists the woman first, but all other materials
		// (including bup algorithms) list the man first.
		// Switch them around
		if (match.dis === 'GD') {
			teams.forEach(function(team) {
				if (team.players.length === 2) {
					team.players = [team.players[1], team.players[0]];
				}
			});
		}

		var network_score = [];
		for (var game_idx = 0;game_idx < game_count;game_idx++) {
			var home_score_str = match['satz' + (1 + game_idx)];
			var away_score_str = match['satz' + (1 + game_count + game_idx)];
			if (home_score_str !== '' && away_score_str !== '') {
				network_score.push([
					parseInt(home_score_str, 10),
					parseInt(away_score_str, 10),
				]);
			}
		}

		var match_id = 'btde_' + utils.iso8601(now) + '_' + match.dis + '_' + home_team_name + '-' + away_team_name;
		if (match.feld) {
			var on_court = utils.find(used_courts, function(c) {
				return c.court_id == match.feld;
			});
			if (on_court) {
				on_court.match_id = match_id;
			}
		}

		var m = /^(.+?)\s*([0-9]+)$/.exec(match.dis);
		var eventsheet_id = match.dis;
		if (m) {
			eventsheet_id = m[2] + '.' + m[1];
		}

		var setup = {
			counting: counting,
			eventsheet_id: eventsheet_id,
			match_name: match.dis,
			is_doubles: is_doubles,
			teams: teams,
			btde_match_id: match.id,
			team_competition: true,
			match_id: match_id,
		};
		setup.incomplete = eventutils.is_incomplete(setup);

		return {
			setup: setup,
			network_score: network_score,
		};
	});
	return {
		team_names: [home_team_name, away_team_name],
		event_name: home_team_name + ' - ' + away_team_name,
		matches: matches,
		courts: used_courts,
		league_key: league_key,
	};
}

function list_matches(s, cb) {
	_request(s, 'btde.list', {
		url: baseurl + 'login/write.php?id=all',
	}, function(err, json) {
		if (err) {
			return cb(err);
		}

		var doc;
		try {
			doc = JSON.parse(json);
		} catch (e) {
			return cb({
				msg: 'badmintonticker-Aktualisierung fehlgeschlagen: Server-Fehler erkannt',
			});
		}
		var ev = _parse_match_list(doc, new Date());
		eventutils.annotate(state, ev);
		return cb(null, ev);
	});
}

function courts(s) {
	return [{
		id: '1',
		description: s._('court:left'),
	}, {
		id: '2',
		description: s._('court:right'),
	}, {
		id: 'referee',
		description: s._('court:referee'),
	}];
}

function ui_init() {
	if (!baseurl) {
		baseurl = '../';
	}
	var m = window.location.pathname.match(/^(.*\/)bup\/(?:bup\.html|index\.html)?$/);
	if (m) {
		baseurl = m[1];
	}
}

function service_name() {
	return 'badmintonticker';
}

/* Paramter: s */
function editable() {
	return true;
}

function calc_btde_player_name(p) {
	var m = /^(.+)\s(.+)$/.exec(p.name);
	if (m) {
		return m[2] + ', ' + m[1];
	} else {
		return p.name;
	}
}

function calc_setup_data(event) {
	var res = {};
	event.matches.forEach(function(match, match_idx) {
		['Heim', 'Gast'].forEach(function(team_id, team_idx) {
			var players = match.setup.teams[team_idx].players;
			var pnames = players.map(calc_btde_player_name);

			if ((match.setup.match_name === 'GD') && (pnames.length === 2)) {
				// Switch around genders for btde
				pnames = [pnames[1], pnames[0]];
			}

			if (match.setup.is_doubles) {
				res[team_id + (match_idx + 1) + '0'] = (pnames.length >= 1) ? pnames[0] : '';
				res[team_id + (match_idx + 1) + '1'] = (pnames.length == 2) ? pnames[1] : '';
			} else {
				res[team_id + (match_idx + 1)] = (pnames.length === 1) ? pnames[0] : '';
			}
		});
	});
	return res;
}

function on_edit_event(s, cb) {
	var data = calc_setup_data(s.event);
	_request(s, 'btde.changeevent', {
		url: baseurl + 'login/start.php',
		data: data,
		method: 'post',
	}, function(err) {
		if (err) {
			return cb(err);
		}

		return cb(null);
	});
}

function parse_key_players(html, key, gender) {
	var options_m = new RegExp(
		'<datalist\\s+id="' + key + '">\\s*' +
		'<select\\s+class="none">\\s*' +
		'((?:<option>[^<]*</option>)*)' +
		'\\s*</select>'
	).exec(html);
	if (!options_m) {
		return [];
	}

	var names_m = utils.match_all(/<option>([^<]+)<\/option>/g, options_m[1]);
	return names_m.map(function(m) {
		var p = _parse_player(m[1]);
		p.gender = gender;
		return p;
	});
}

function list_all_players(s, cb) {
	_request(s, 'btde.list_all_players', {
		url: baseurl + 'login/start.php',
	}, function(err, html) {
		if (err) {
			return cb(err);
		}

		var all_players = [
			parse_key_players(html, 'heimM', 'm').concat(
				parse_key_players(html, 'heimF', 'f')),
			parse_key_players(html, 'gastM', 'm').concat(
				parse_key_players(html, 'gastF', 'f'))];
		return cb(null, all_players);
	});

}

return {
	ui_init: ui_init,
	ui_render_login: ui_render_login,
	send_press: send_press,
	list_matches: list_matches,
	sync: sync,
	courts: courts,
	service_name: service_name,
	editable: editable,
	on_edit_event: on_edit_event,
	list_all_players: list_all_players,
	// Testing only
	_parse_match_list: _parse_match_list,
};

}

/*@DEV*/
if ((typeof module !== 'undefined') && (typeof require !== 'undefined')) {
	var calc = require('./calc');
	var eventutils = require('./eventutils');
	var network = require('./network');
	var utils = require('./utils');

	module.exports = btde;
}
/*/@DEV*/
