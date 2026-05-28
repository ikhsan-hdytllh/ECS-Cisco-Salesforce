import React, { useState, useEffect } from 'react';
import { Deal } from '../types';
import { X } from 'lucide-react';
import { generateId, getCiscoQuarter } from '../utils';

interface DealModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (deal: Deal) => void;
  editingDeal: Deal | null;
}

const emptyDeal: Omit<Deal, 'id'> = {
  Product: '',
  Enduser: '',
  Partner: '',
  AM_Cisco: '',
  Pricelist: 0,
  Disc: 0,
  Value_Net: 0,
  Archi: 'EN',
  DID: '',
  Estimate: '',
  Stage: 10,
  Req_Masuk_Date: '',
  Req_Masuk: '',
  Estimate_Close_Date: '',
  Estimate_Close: '',
  Channel_ECS: '',
  PIC_Presales: '',
  Remarks: '',
};

export function DealModal({ isOpen, onClose, onSave, editingDeal }: DealModalProps) {
  const [formData, setFormData] = useState<Omit<Deal, 'id'>>(emptyDeal);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (editingDeal) {
      setFormData(editingDeal);
    } else {
      setFormData(emptyDeal);
    }
    setErrors({});
  }, [editingDeal, isOpen]);

  if (!isOpen) return null;

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.Product.trim()) newErrors.Product = 'Product is required';
    if (!formData.Enduser.trim()) newErrors.Enduser = 'Enduser is required';
    if (formData.Value_Net <= 0) newErrors.Value_Net = 'Value Net must be > 0';
    if (![0, 10, 25, 50, 75, 90, 100].includes(formData.Stage)) newErrors.Stage = 'Invalid Stage %';
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    
    let parsedValue: any = value;
    if (type === 'number' || name === 'Stage') {
      parsedValue = value === '' ? 0 : Number(value);
    }

    setFormData((prev) => ({
      ...prev,
      [name]: parsedValue,
    }));
  };

  const handlePricelistDiscChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    const numValue = value === '' ? 0 : Number(value);
    
    setFormData((prev) => {
      const updated = { ...prev, [name]: numValue };
      // Auto-calculate Value_Net if Pricelist and Disc are used
      if (name === 'Pricelist') {
        updated.Value_Net = numValue * (1 - prev.Disc / 100);
      } else if (name === 'Disc') {
        updated.Value_Net = prev.Pricelist * (1 - numValue / 100);
      }
      return updated;
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validate()) {
      onSave({
        ...(editingDeal ? { id: editingDeal.id } : { id: generateId() }),
        ...formData,
      } as Deal);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm overflow-y-auto pt-10 pb-10">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl flex flex-col max-h-[90vh]">
        <div className="flex justify-between items-center p-5 border-b border-gray-200">
          <h2 className="text-xl font-bold text-slate-800">
            {editingDeal ? 'Edit Deal' : 'Add New Deal'}
          </h2>
          <button onClick={onClose} className="p-1 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1 custom-scrollbar">
          <form id="deal-form" onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Required Fields Group */}
            <div className="col-span-1 md:col-span-2 bg-blue-50/50 p-4 rounded-lg border border-blue-100 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  BDM / Product Specialist <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="Product"
                  value={formData.Product}
                  onChange={handleChange}
                  className={`w-full p-2 border rounded-md outline-none focus:ring-2 focus:ring-cisco-blue/50 ${errors.Product ? 'border-red-500' : 'border-gray-300'}`}
                  placeholder="e.g. Rina (BDM EN)"
                />
                {errors.Product && <p className="text-red-500 text-xs mt-1">{errors.Product}</p>}
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Enduser <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="Enduser"
                  value={formData.Enduser}
                  onChange={handleChange}
                  className={`w-full p-2 border rounded-md outline-none focus:ring-2 focus:ring-cisco-blue/50 ${errors.Enduser ? 'border-red-500' : 'border-gray-300'}`}
                  placeholder="e.g. Pertamina"
                />
                {errors.Enduser && <p className="text-red-500 text-xs mt-1">{errors.Enduser}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Value Net (USD) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  name="Value_Net"
                  value={formData.Value_Net}
                  onChange={handleChange}
                  className={`w-full p-2 border rounded-md outline-none focus:ring-2 focus:ring-cisco-blue/50 ${errors.Value_Net ? 'border-red-500' : 'border-gray-300'}`}
                />
                {errors.Value_Net && <p className="text-red-500 text-xs mt-1">{errors.Value_Net}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Stage % <span className="text-red-500">*</span>
                </label>
                <select
                  name="Stage"
                  value={formData.Stage}
                  onChange={handleChange}
                  className={`w-full p-2 border rounded-md outline-none focus:ring-2 focus:ring-cisco-blue/50 bg-white ${errors.Stage ? 'border-red-500' : 'border-gray-300'}`}
                >
                  <option value={0}>0% (Closed Lost)</option>
                  <option value={10}>10% (Prospecting)</option>
                  <option value={25}>25% (Qualification)</option>
                  <option value={50}>50% (Proposal)</option>
                  <option value={75}>75% (Negotiation)</option>
                  <option value={90}>90% (Verbal Agreement)</option>
                  <option value={100}>100% (Closed Won)</option>
                </select>
                {errors.Stage && <p className="text-red-500 text-xs mt-1">{errors.Stage}</p>}
              </div>
            </div>

            {/* General Info */}
            <h3 className="col-span-1 md:col-span-2 font-semibold text-slate-800 mt-2 border-b pb-1">General Info</h3>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Partner</label>
              <input type="text" name="Partner" value={formData.Partner} onChange={handleChange} className="w-full p-2 border border-gray-300 rounded-md outline-none focus:ring-2 focus:ring-cisco-blue/50" />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">AM Cisco</label>
              <input type="text" name="AM_Cisco" value={formData.AM_Cisco} onChange={handleChange} className="w-full p-2 border border-gray-300 rounded-md outline-none focus:ring-2 focus:ring-cisco-blue/50" />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Pricelist (USD)</label>
              <input type="number" name="Pricelist" value={formData.Pricelist} onChange={handlePricelistDiscChange} className="w-full p-2 border border-gray-300 rounded-md outline-none focus:ring-2 focus:ring-cisco-blue/50" />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Discount %</label>
              <input type="number" name="Disc" value={formData.Disc} onChange={handlePricelistDiscChange} className="w-full p-2 border border-gray-300 rounded-md outline-none focus:ring-2 focus:ring-cisco-blue/50" max="100" min="0" />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Architecture</label>
              <select name="Archi" value={formData.Archi} onChange={handleChange} className="w-full p-2 border border-gray-300 rounded-md outline-none focus:ring-2 focus:ring-cisco-blue/50 bg-white">
                <option value="EN">Enterprise Network (EN)</option>
                <option value="DC">Data Center (DC)</option>
                <option value="SEC">Security (SEC)</option>
                <option value="COLLAB">Collaboration (COLLAB)</option>
                <option value="OPTICS">Optics</option>
                <option value="CX">Customer Experience (CX)</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Deal ID (DID)</label>
              <input type="text" name="DID" value={formData.DID} onChange={handleChange} className="w-full p-2 border border-gray-300 rounded-md outline-none focus:ring-2 focus:ring-cisco-blue/50" />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Estimate ID</label>
              <input type="text" name="Estimate" value={formData.Estimate} onChange={handleChange} className="w-full p-2 border border-gray-300 rounded-md outline-none focus:ring-2 focus:ring-cisco-blue/50" />
            </div>

            {/* Timing & Team */}
            <h3 className="col-span-1 md:col-span-2 font-semibold text-slate-800 mt-2 border-b pb-1">Timing & Team</h3>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Req Masuk (Date)</label>
              <input 
                type="date" 
                name="Req_Masuk_Date" 
                value={formData.Req_Masuk_Date || ''} 
                onChange={(e) => {
                  handleChange(e);
                  setFormData(prev => ({ ...prev, Req_Masuk_Date: e.target.value, Req_Masuk: getCiscoQuarter(e.target.value) }));
                }} 
                className="w-full p-2 border border-gray-300 rounded-md outline-none focus:ring-2 focus:ring-cisco-blue/50" 
              />
              {formData.Req_Masuk && <p className="text-xs text-cisco-blue font-medium mt-1">Quarter: {formData.Req_Masuk}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Est. Close (Date)</label>
              <input 
                type="date" 
                name="Estimate_Close_Date" 
                value={formData.Estimate_Close_Date || ''} 
                onChange={(e) => {
                  handleChange(e);
                  setFormData(prev => ({ ...prev, Estimate_Close_Date: e.target.value, Estimate_Close: getCiscoQuarter(e.target.value) }));
                }} 
                className="w-full p-2 border border-gray-300 rounded-md outline-none focus:ring-2 focus:ring-cisco-blue/50" 
              />
              {formData.Estimate_Close && <p className="text-xs text-cisco-blue font-medium mt-1">Quarter: {formData.Estimate_Close}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Channel ECS</label>
              <input type="text" name="Channel_ECS" value={formData.Channel_ECS} onChange={handleChange} className="w-full p-2 border border-gray-300 rounded-md outline-none focus:ring-2 focus:ring-cisco-blue/50" />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">PIC Presales</label>
              <input type="text" name="PIC_Presales" value={formData.PIC_Presales} onChange={handleChange} className="w-full p-2 border border-gray-300 rounded-md outline-none focus:ring-2 focus:ring-cisco-blue/50" />
            </div>

            <div className="col-span-1 md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Remarks</label>
              <textarea name="Remarks" rows={2} value={formData.Remarks} onChange={handleChange} className="w-full p-2 border border-gray-300 rounded-md outline-none focus:ring-2 focus:ring-cisco-blue/50 custom-scrollbar" />
            </div>
          </form>
        </div>

        <div className="p-5 border-t border-gray-200 bg-gray-50 flex justify-end gap-3 rounded-b-xl">
          <button 
            type="button" 
            onClick={onClose} 
            className="px-5 py-2 rounded-md font-medium text-slate-700 hover:bg-gray-200 transition-colors border border-gray-300"
          >
            Cancel
          </button>
          <button 
            type="submit" 
            form="deal-form" 
            className="px-5 py-2 bg-[#049fd9] hover:bg-[#038bc2] text-white rounded-md font-medium transition-colors shadow-sm"
          >
            {editingDeal ? 'Save Changes' : 'Create Deal'}
          </button>
        </div>
      </div>
    </div>
  );
}
