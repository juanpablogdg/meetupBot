const request = require('request');
const _ = require('lodash');
const dateFormat = require('dateformat');
const runtimeConfig = require('cloud-functions-runtime-config');



let assistantResponse = {
    speech: '',
    text: ''
};


/**
 * Evaluate if value is undefined
 * @param value value to check
 * @returns {boolean} true if is defined, false in other case
 */
function isUndefined(value) {
    return typeof value === 'undefined';
}

/**
 * Retrieves the topic from the parameter object
 * @param parameters request's parameters
 * @returns topic or empty string
 */
function getTopic(parameters) {
    if (!isUndefined(parameters.Topic)) {
        return parameters.Topic;
    }
    else {
        return '';
    }
}

function getDateFrom(parameters) {
    return new Date(parameters['date-period'].split('/')[0]);
}

/**
 *
 * @param parameters
 * @returns {Date}
 */
function getDateTo(parameters) {
    return new Date(parameters['date-period'].split('/')[1]);
}

/**
 * Responds to any HTTP request that can provide a "message" field in the body.
 *
 * @param {!Object} req Cloud Function request context.
 * @param {!Object} res Cloud Function response context.
 */
exports.meetup = (req, res) => {

    const parameters = req.body.result.parameters;

    console.log('Request ' + JSON.stringify(req.body));


    console.log("Parameters " + JSON.stringify(parameters));
    console.log("parameters " + parameters['date-period']);

    topic = getTopic(parameters);
    dateFrom = (parameters['date-period'] === '') ? new Date() : getDateFrom(parameters);
    dateTo = (parameters['date-period'] === '') ? new Date('12/31/2040') : getDateTo(parameters);


    const topicParam = topic === '' ? '' : '&text=' + topic;




    runtimeConfig.getVariable('dev-config', 'api-key').then((apiKey)=>{

        const API_URL = 'https://api.meetup.com/';
        const FIND_GROUPS = 'find/groups?';
        const KEY = 'key='+apiKey+'&sign=true';
        const ZIP = '&zip=meetup1';
        const FILTER_FIELDS = '&only=score,name,link,city,next_event';
        const MAX_PAGE = '&page=50';
        const TECH_CATEGORY = '&category=34';

        const params = KEY + ZIP + TECH_CATEGORY + topicParam + FILTER_FIELDS + MAX_PAGE;


        console.log(API_URL + FIND_GROUPS + params);

        request(API_URL + FIND_GROUPS + params, function (error, response, body) {




        let meetups = JSON.parse(body);

        console.log(JSON.stringify(meetups));

        responseJson = meetups.filter(function (meetup) {
            return !isUndefined(meetup.next_event);
        })
            .filter(function (meetup) {
                return meetup.next_event.time > dateFrom.getTime() && meetup.next_event.time < dateTo.getTime();
            })
            .map(function (meetup) {
                let detail = {
                    name: meetup.name,
                    link: meetup.link,
                    eventName: isUndefined(meetup.next_event.name) ? 'error' : meetup.next_event.name,
                    eventDate: new Date(meetup.next_event.time)
                };
                return detail;
            });
        //Date order array
        responseJson.sort(function (a, b) {
            return a.eventDate.getTime() - b.eventDate.getTime()
        });


        let responseToUser = humanizeResponse(req, responseJson);
        assistantResponse.speech = responseToUser;
        assistantResponse.text = responseToUser;

        res.status(200).send(assistantResponse);


    });


    })
        .catch((err) => res.status(500).send(err));


    /**
     * Transform the answer into a humand-understandable reply
     * @param req request
     * @param responseJson JSON with the answer from meetup.com
     * @returns {string} user response
     */

    function humanizeResponse(req, responseJson) {

        const parameters = req.body.result.parameters;
        let requestSource = (req.body.originalRequest) ? req.body.originalRequest.source : undefined;


        let responseText = '';
        let extraInfo = '';

        topic = getTopic(parameters);

        if (topic !== '') {
            extraInfo += ' sobre ' + topic;
        }

        if (parameters['date-period'] !== '') {
            extraInfo += ' entre ' + dateFormat(getDateFrom(parameters), 'dd/mm/yy') + ' y ' + dateFormat(getDateTo(parameters), 'dd/mm/yy');
        }

        if (responseJson.length > 0) {

            responseText = 'He encontrado ' + responseJson.length + ' resultados ' + extraInfo + '. Son los siguientes :\n';


            responseJson.forEach(function (detail) {
                if (requestSource === 'google') {


                    let detailAssistanMessage = 'El grupo ' + detail.name + ' organiza ' + detail.eventName + ' el próximo día ' + dateFormat(detail.eventDate, 'dd/mm/yy') + '.\n';
                    responseText = responseText.concat(detailAssistanMessage);

                }
                else {
                    let detailSlackMessage = '<' + detail.link + ' | ' + detail.name + '> - ' +
                        '*' + detail.eventName + '* el próximo día ' + dateFormat(detail.eventDate, 'dd/mm/yy') + '\n';
                    responseText = responseText.concat(detailSlackMessage);
                }


            });


        } else {

            responseText = 'Lo siento no he podido encontrar nada' + extraInfo;
        }


        return responseText;

    }


}
;
