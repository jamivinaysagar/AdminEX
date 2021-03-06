import React from 'react'

export default (props) => {

  const inputType = props.type ? props.type : 'text'

  return (
    <div className="slds-form-element" style={props.style}>
      <label className="slds-form-element__label">{ props.label }
        {props.required ? <abbr className="slds-required" title="required">*</abbr> : '' }
      </label>
      <div className="slds-form-element__control">
        <input 
          type={inputType}
          className="slds-input" 
          value={props.value}
          placeholder={ props.placeholder } 
          onChange={ (e) => props.onChange(e.target.value) }/>
      </div>
    </div>
  )
}