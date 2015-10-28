/**
 * Created by Anastasia Oblomova on 21.10.15.
 */

var TestRail = require('node-testrail');
var async = require('async');
var _ = require('lodash');
var config = require('moonraker').config.testrailReporter;
var testrail = new TestRail(config.url, config.username, config.password);
var projectId = config.projectID;
var milestone = config.milestone || null;
var currentSuite;
var currentRun;
var casesForResult = [];
var sectionsForResult = [];

module.exports = {

  //function update all cases in suite
  updateSuites: function (autotestSuite, callback) {
    casesForResult = [];
    sectionsForResult = [];

    testrail.getSuites(projectId, function (suits) { //find all suites in testrail
      suits = JSON.parse(suits);
      console.log('Updating suite... Please wait. (' + autotestSuite.title + ')');

      var trSuite = _.filter(suits, function (suite) {
        return suite.name === autotestSuite.title;
      })[0];

      if (trSuite) {
        currentSuite = trSuite; //save current suite

        testrail.getSections(projectId, trSuite.id, function (sections) { //find all sections
          sections = JSON.parse(sections);

          async.mapSeries(autotestSuite.suites, function (scenario, clb) {
            var trSection = _.filter(sections, function (section) {
              return section.name === scenario.title;
            })[0];

            if (trSection) {
              testrail.getCases(projectId, trSuite.id, trSection.id, function (cases) { //find all cases for this section
                cases = JSON.parse(cases);

                var caseTitles = _.map(cases, 'title');
                var testTitles = _.map(scenario.tests, 'title');

                if (caseTitles.toString() !== testTitles.toString()) {  //update cases if section exists and create cases if section not exists
                  testrail.deleteSection(trSection.id, function (res) { //delete section and create cases
                    addSectionAndCases(projectId, trSuite, scenario, function () {
                      clb(null);
                    });
                  });
                } else { //do nothing
                  sectionsForResult = sectionsForResult.concat(trSection);
                  casesForResult = casesForResult.concat(cases);
                  console.log('Cases already updated (' + scenario.title + ')');
                  clb(null);
                }
              });
            } else { //section not exists, add new sections and cases
              addSectionAndCases(projectId, trSuite, scenario, function () {
                clb(null);
              });
            }
          }, function (err, results) {
            callback(null);
          });
        });
      } else { //if suite not exists
        testrail.addSuite(projectId, autotestSuite.title, null, function (newSuite) {
          newSuite = JSON.parse(newSuite);

          currentSuite = newSuite; //save current suite

          async.mapSeries(autotestSuite.suites, function (scenario, clb) {
            addSectionAndCases(projectId, newSuite, scenario, function () {
              clb(null);
            });
          }, function (err, results) {
            callback();
          });
        })
      }
    });
  },

  //function for create new run
  createRun: function (callback) {
    testrail.addRun(projectId, currentSuite.id, currentSuite.name, null, milestone, function (newRun) {
      newRun = JSON.parse(newRun);
      currentRun = newRun;
      callback();
    })
  },

  //function for adds results for existing tests
  addResult: function (scenarioTitle, caseTitle, resultID, description, elapsed_time,  callback) {

    if (elapsed_time) { //time should be null or > 0
      elapsed_time = _.ceil(elapsed_time / 1000).toString() + ' s';
    } else {
      elapsed_time = null;
    }

    if (description) description = description.toString();

    var sec = _.filter(sectionsForResult, function (trSection) {
      return trSection.name === scenarioTitle;
    })[0];

    if (sec) {
      var trSectionID = sec.id;
      var cas = _.filter(casesForResult, function (trCase) {
        return (trCase.title === caseTitle) && (trCase.section_id === trSectionID);
      })[0];

      if (cas) {
        var trCaseID = cas.id;
        casesForResult = _.filter(casesForResult, function (trCase) { //remove case from array, that not repeat in next step
          return trCase.id !== trCaseID;
        });

        if (trCaseID) {
          testrail.addResultForCase(currentRun.id, trCaseID, resultID, description, null, elapsed_time, null, null, function (result) {
            if (!result) {//if testRailApi return '', that send request again
              testrail.addResultForCase(currentRun.id, trCaseID, resultID, description, null, elapsed_time, null, null, function (result) {
                if (!result) {
                  console.error('Request result is empty! Result not added! (' + caseTitle + ')');
                } else {
                  callback();
                }
              });
            } else {
              callback();
            }
          })
        } else {
          console.error('No such test! (id:', trCaseID, 'case title:', caseTitle + ')');
          callback();
        }
      } else {
        console.error('Case not found! (' + caseTitle + ')');
        callback();
      }
    } else {
      console.error('Section not found! (' + scenarioTitle + ')');
      callback();
    }
  },

  closeRun: function (callback) {
    testrail.closeRun(currentRun.id, function (res) {
      callback();
    })
  },

  getViewResultsUrl: function () {
    if (milestone) {
      return config.url + 'index.php?/milestones/view/' + milestone;
    } else {
      return config.url + 'index.php?/runs/overview/' + projectId;
    }
  }
};

//function for add new sections and cases
function addSectionAndCases(projectId, trSuite, scenario, callback) {
  testrail.addSection(projectId, trSuite.id, null, scenario.title, function (newSection) {
    newSection = JSON.parse(newSection);
    var testTitles = _.map(scenario.tests, 'title');

    return async.mapSeries(testTitles, function (title, cb) {
      testrail.addCase(newSection.id, title, null, projectId, null, null, null, function (res) {

        if (!res) {//if testRailApi return '', that send request again
          testrail.addCase(newSection.id, title, null, projectId, null, null, null, function (res) {
            if (!res) {
              console.error('Request result is empty. Case not added! (' + title + ')');
              cb(null);
            } else {
              cb(null, JSON.parse(res));
            }
          });
        } else {
          cb(null, JSON.parse(res));
        }
      })
    }, function (err, results) {
      sectionsForResult = sectionsForResult.concat(newSection);
      casesForResult = casesForResult.concat(results);
      console.log('Were added section and cases in TestRail (' + scenario.title + ')');
      callback();
    });
  });
}
