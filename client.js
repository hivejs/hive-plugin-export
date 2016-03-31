var vdom = require('virtual-dom')
  , h = vdom.h

module.exports = setup
module.exports.consumes = ['ui', 'api']
module.exports.provides = ['export']

const EXPORTED = 'EXPORT_EXPORTED'
const EXPORTING = 'EXPORT_EXPORTING'
const TOGGLE_EXPORT_DROPDOWN = 'EXPORT_TOGGLE_DROPDOWN'

function setup(plugin, imports, register) {
  var ui = imports.ui
    , api = imports.api

  ui.reduxReducerMap['export'] = reducer

  function reducer(state, action) {
    if(!state) {
      return {
        exportTypes: ui.config['importexport:exportTypes']
      , showExportDropdown: false
      , exporting: false
      , exportError: false
      }
    }
    if(TOGGLE_EXPORT_DROPDOWN === action.type) {
      return {...state
      , showExportDropdown: !state.showExportDropdown
      , exportError: false
      }
    }
    if(EXPORTING == action.type) {
      return {...state, exporting: action.payload, exportError: false}
    }
    if(EXPORTED == action.type && action.error) {
      return {...state
      , exporting: false
      , exportError: action.error
      }
    }
    if(EXPORTED == action.type) {
      return {...state
      , exporting: false
      , showExportDropdown: false
      , exportError: false
      }
    }
    return state
  }

  ui.reduxMiddleware.push(middleware)
  function middleware(store) {
    return next => action => {
      if(EXPORTED === action.type && !action.error) {
        var dataURI = URL.createObjectURL(action.payload.blob)
        download('export', dataURI)
      }
      return next(action)
    }
  }

  var exportProvider = {
    action_export: function *(exportType) {
      try {
      yield exportProvider.action_exporting(exportType)
      var documentId = ui.store.getState().editor.document.id
      var document = yield api.action_document_get(documentId)
      var blob = yield api.action_snapshot_export(document.relationships.latestSnapshot.data.id, exportType)
      yield {type: EXPORTED, payload: {type: exportType, blob}}
      }catch(e) {
        console.error(e)
        yield {type: EXPORTED, error: e.message}
      }
    }
  , action_toggleExportDropdown: function() {
      return {type: TOGGLE_EXPORT_DROPDOWN}
    }
  , action_exporting: function(type) {
      return {type: EXPORTING, payload:type}
    }
  , renderExport
  , renderExportDropdown
  }

  ui.onRenderNavbarRight((store, children) => {
    var state = store.getState()
    if(!state.editor.editor) return
    if(state.editor.document && state['export'].exportTypes[state.editor.document.attributes.type]) {
      children.unshift(renderExport(store))
    }
  })

  function renderExport(store) {
    var state = store.getState()['export']
    return h('li.dropdown'+(state.showExportDropdown? '.open' : ''), [
      h('a.dropdown-toggle', {
          href: 'javascript:void(0)'
        , 'ev-click': evt => store.dispatch(exportProvider.action_toggleExportDropdown())
        , id: 'exportMenu'
        , attributes: {
            'data-toggle': 'dropdown'
          , 'aria-haspopup': 'true'
          , 'aria-expanded': state.showDropdown? 'true' : 'false'
          }
        , title: ui._('plugin-export/export')()
        }
      , [
          h('span.sr-only', ui._('plugin-export/export')())
        , h('i.glyphicon.glyphicon-export')
        , h('span.caret')
        ]
      )
    , h('ul.dropdown-menu'
      , { attributes: {'aria-labelledby':'exportMenu'}
        }
      , renderExportDropdown(store)
      )
    ])
  }

  function renderExportDropdown(store) {
    var document = store.getState().editor.document
    var state = store.getState()['export']
    return [h('li.dropdown-header', ui._('plugin-export/export')())]
    .concat(
      state.exportTypes[document.attributes.type].map(exportType => {
        return h('li', h('a'
        , { href:'javascript:void(0)'
          , 'ev-click': evt => store.dispatch(
              exportProvider.action_export(exportType))
          }
        , ui._('plugin-export/format-'+exportType.replace('/', '-'))()
        +(state.exporting === exportType?
            ' '+ui._('plugin-export/exporting')()
          : ''
        )
        ))
      })
    ).concat([
      state.exportError?
        h('li', h('div.alert.alert-danger', [
          h('strong', 'Error'), ' '+state.exportError
        ]))
      : ''
    ])
  }

  register(null, {'export': exportProvider})
}

function download(filename, dataURI) {
  // Construct the <a> element
  var link = document.createElement("a");
  link.download = filename;
  // Construct the uri
  link.href = dataURI;
  document.body.appendChild(link);
  link.click();
  // Cleanup the DOM
  document.body.removeChild(link);
}
