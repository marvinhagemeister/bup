var report_problem = (function() {
'use strict';

var REPORT_URL = 'https://aufschlagwechsel.de/bupbug/';
var last_error = '-';
var reported_count = 0;


function get_info() {
	return {
		_type: 'bup-error',
		ua: window.navigator.userAgent,
		url: window.location.href,
		bup_version: bup_version,
		size: document.documentElement.clientWidth + 'x' + document.documentElement.clientHeight,
		last_error: last_error,
		reported_count: reported_count,
	};
}

function report(info_obj) {
	var is_dev = false;
	/*@DEV*/
	is_dev = true;
	/*/@DEV*/
	if (is_dev) {
		return;
	}

	reported_count++;
	if (reported_count > 3) {
		return;
	}

	var json_report = JSON.stringify(info_obj);

	var xhr = new XMLHttpRequest();
	xhr.open('POST', REPORT_URL, true);
	xhr.setRequestHeader('Content-type', 'text/plain');  // To be a simple CORS request
	xhr.send(json_report);
}

function update() {
	var report_problem_body = state._('report:body');
	var info = get_info();
	info.last_error = (info.last_error ? JSON.stringify(info.last_error) : '-');
	for (var k in info) {
		report_problem_body = report_problem_body.replace('{' + k + '}', info[k]);
	}
	var report_problem_link = (
		'mailto:phihag@phihag.de?' +
		'subject=' + encodeURIComponent(state._('report:subject')) +
		'&body=' + encodeURIComponent(report_problem_body)
	);
	$('.settings_report_problem').attr('href', report_problem_link);
}

function on_error(msg, script_url, line, col, err) {
	last_error = {
		msg: msg,
		script_url: script_url,
		line: line,
		col: col,
	};
	if (err) {
		last_error.stack = err.stack;
	}
	update();
	report(get_info());
}

function ui_init() {
	update();
	window.onerror = on_error;
	$('.version').on('click', function() {
		$('.settings_test_reporting').show();
	});
	$('.settings_test_reporting').on('click', function() {
		throw new Error('test error reporting');
	});
}

return {
	update: update,
	ui_init: ui_init,
	report: report,
};

})();

/*@DEV*/
if ((typeof module !== 'undefined') && (typeof require !== 'undefined')) {
	module.exports = report_problem;
}
/*/@DEV*/