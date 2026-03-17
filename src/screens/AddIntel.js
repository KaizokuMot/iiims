import React, { useState } from 'react';
import './AddIntel.css'; 
import TabScreen from './TabScreen';
import IntelAtom from '../atoms/IntelAtom';

const AddIntel = () => {

    return (
        <div className='add-intel-page'>
            <IntelAtom/>
        </div>
        
    );
};

export default AddIntel;
