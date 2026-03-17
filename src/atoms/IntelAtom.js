import React, { useState } from 'react';
import "../screens/AddIntel.css";
import IntelData from '../TestDataPoint/Intel';
import { Hub } from '../services/CentralHubService';
import { useNavigate } from 'react-router-dom';

function IntelAtom() {
    const navigate = useNavigate();
    const [step, setStep] = useState(1);
    const [formData, setFormData] = useState({
        name: '', age: '', dob: '', location: '', mobile: '', gender: '', occupation: '', nationalId: '', caseType: ''
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [successMsg, setSuccessMsg] = useState('');

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async () => {
        if (!formData.name || !formData.caseType || !formData.location) {
            alert("Name, Case Type, and Location are required.");
            return;
        }
        
        setIsSubmitting(true);

        // 1. Construct new Investigation Data
        const newIntel = {
            id: 'intel_' + Date.now(),
            intelType: formData.caseType,
            priority: 'medium',
            officersOnScene: [],
            dateCreated: new Date().toLocaleDateString(),
            postedBy: 'System Add',
            victims: [],
            status: 'open',
            location: formData.location,
            desc: `Suspect added: ${formData.name}. Occupation: ${formData.occupation}, National ID: ${formData.nationalId}, Mobile: ${formData.mobile}.`,
            suspects: [formData.name]
        };

        // 2. Add to static array
        IntelData.allInvestigations.unshift(newIntel);

        // 3. Register to Central Hub Index
        await Hub.registerIntelligence('DOCUMENT_ANALYSIS', {
            name: 'System Intel Upload',
            analysis: {
                entities: {
                    people: [formData.name],
                    places: [formData.location]
                },
                summary: {
                    description: `Manually added suspect/evidence record for ${formData.name}. Case: ${formData.caseType}`
                }
            }
        });

        setIsSubmitting(false);
        setSuccessMsg("Intelligence successfully added to Central Hub!");
        
        setTimeout(() => {
            navigate('/');
        }, 2000);
    };

    return (
        <div className='add-intel-page'>
            <div className="container" style={{ position: 'relative' }}>
                <header className='suspect-header'>Process Suspect/Evidence</header>
                {successMsg && (
                    <div style={{ background: '#10b981', color: 'white', padding: '10px', borderRadius: '4px', marginBottom: '15px', textAlign: 'center' }}>
                        {successMsg}
                    </div>
                )}
                <form className='add-intel-form'>
                    {step === 1 && (
                        <div className="form first">
                            <div className="details personal">
                                <span className="title">Details</span>
                                <div className="fields">
                                    <div className="input-field">
                                        <label>Full Name *</label>
                                        <input type="text" name="name" value={formData.name} onChange={handleChange} placeholder="Enter your name" required />
                                    </div>
                                    <div className="input-field">
                                        <label>Age</label>
                                        <input type="number" name="age" value={formData.age} onChange={handleChange} placeholder="Age If Applicable" />
                                    </div>
                                    <div className="input-field">
                                        <label>Date of Birth</label>
                                        <input type="date" name="dob" value={formData.dob} onChange={handleChange} placeholder="Enter birth date" />
                                    </div>
                                    <div className="input-field">
                                        <label>Location *</label>
                                        <input type="text" name="location" value={formData.location} onChange={handleChange} placeholder="Add Location (e.g. Kampala)" required />
                                    </div>
                                    <div className="input-field">
                                        <label>Mobile Number</label>
                                        <input type="tel" name="mobile" value={formData.mobile} onChange={handleChange} placeholder="Enter mobile number" />
                                    </div>
                                    <div className="input-field">
                                        <label>Gender</label>
                                        <select name="gender" value={formData.gender} onChange={handleChange}>
                                            <option value="" disabled>Select gender</option>
                                            <option value="Male">Male</option>
                                            <option value="Female">Female</option>
                                            <option value="Others">Others</option>
                                        </select>
                                    </div>
                                    <div className="input-field">
                                        <label>Occupation</label>
                                        <input type="text" name="occupation" value={formData.occupation} onChange={handleChange} placeholder="Enter occupation" />
                                    </div>
                                    <div className="input-field">
                                        <label>National ID Number</label>
                                        <input type="text" name="nationalId" value={formData.nationalId} onChange={handleChange} placeholder="Enter National ID" />
                                    </div>
                                    <div className="input-field">
                                        <label>Case Type *</label>
                                        <input type="text" name="caseType" value={formData.caseType} onChange={handleChange} placeholder="Enter Case Type" required />
                                    </div>
                                </div>
                            </div>
                            <button className="nextBtn cls" type="button" onClick={handleSubmit} disabled={isSubmitting} style={{ background: isSubmitting ? '#94a3b8' : '#3b82f6', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '5px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                                <span className="btnText btn-cls cls" style={{ marginRight: '8px' }}>{isSubmitting ? 'Saving...' : 'Save Intel'}</span>
                                <i className="uil uil-navigator"></i>
                            </button>
                        </div>
                    )}
                </form>
            </div>
        </div>
    );
}

export default IntelAtom;