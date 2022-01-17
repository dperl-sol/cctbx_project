##################################################################################
# Copyright(c) 2021, Richardson Lab at Duke
# Licensed under the Apache 2 license
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissionsand
# limitations under the License.

from __future__ import absolute_import, division, print_function
import sys
import os
import time
from datetime import datetime
from libtbx.program_template import ProgramTemplate
from libtbx import group_args, phil
from libtbx.str_utils import make_sub_header
from libtbx.utils import Sorry
import mmtbx
from mmtbx.probe import Helpers
from iotbx import pdb
# @todo See if we can remove the shift and box once reduce_hydrogen is complete
from cctbx.maptbx.box import shift_and_box_model
from mmtbx.hydrogens import reduce_hydrogen
from mmtbx.reduce import Optimizers

version = "0.2.0"

master_phil_str = '''
approach = *add remove
  .type = choice
  .help = Determines whether Reduce will add (and optimize) or remove Hydrogens from the model
n_terminal_charge = *residue_one first_in_chain no_charge
  .type = choice(multi=False)
  .help = Mode for placing H3 at terminal nitrogen.
use_neutron_distances = False
  .type = bool
  .help = Use neutron distances (-nuclear in reduce)
preference_magnitude = 1.0
  .type = float
  .help = Multiplier on the rotational-preference energy for rotatable Movers (-penalty in reduce)
alt_id = None
  .type = str
  .short_caption = Alternate to optimize
  .help = Alternate to optimize.  The default is to optimize all of them.
add_flip_movers = False
  .type = bool
  .help = Insert flip movers (-flip, -build, -noflip, -demandflipallnhqs in reduce)
profile = False
  .type = bool
  .help = Profile the performance of the entire run

output
  .style = menu_item auto_align
{
  model_file_base_name = None
    .type = str
    .short_caption = Model output file name base
    .help = Model output file name
  description_file_name = None
    .type = str
    .short_caption = Description output file name
    .help = Description output file name
}
''' + Helpers.probe_phil_parameters

program_citations = phil.parse('''
citation {
  authors = Word, et. al.
  journal = J. Mol. Biol.
  volume = 285
  pages = 1735-1747
  year = 1999
  external = True
}
''')

# ------------------------------------------------------------------------------

class Program(ProgramTemplate):
  description = '''
Reduce2 version {}
Add Hydrogens to a model and optimize their placement by adjusting movable groups and
flippable groups of atoms.

Inputs:
  PDB or mmCIF file containing atomic model
  Ligand CIF file, if needed
Output:
  PDB or mmCIF file with added hydrogens.  If output.suffix is set to "pdb" then a PDB file
  will be written, otherwise an mmCIF (.cif) file will be written.  If output.model_file_base_name
  is specified, that will be the base file name that is written; otherwise, the file will be
  written into the current working directory with the same base name as the original file and
  with _reduced added to it; 1xs0.pdb would be written to ./1xso_reduced.cif by default.

NOTES:
  Equivalent PHIL arguments for original Reduce command-line options:
    -quiet: No equivalent; metadata is never written to the model file, it is always
            written to the description file, and progress information is always written
            to standard output.
    -trim: approach=remove
    -build: approach=add add_flip_movers=True
    -flip: approach=add add_flip_movers=True
    -allalt: This is the default.
    -penalty200: preference_magnitude=200
    -nobuild9999: approach=add preference_magnitude=9999
    -noflip: approach=add add_flip_movers=True preference_magnitude=9999
    -onlya: alt_id=A
     @todo
'''.format(version)
  datatypes = ['model', 'restraint', 'phil']
  master_phil_str = master_phil_str
  data_manager_options = ['model_skip_expand_with_mtrix',
                          'model_skip_ss_annotations']
  citations = program_citations
  epilog = '''
  For additional information and help, see http://kinemage.biochem.duke.edu/software/probe
  and http://molprobity.biochem.duke.edu
  '''

# ------------------------------------------------------------------------------

  def validate(self):
    self.data_manager.has_models(raise_sorry=True)
    #if self.params.output.model_file_name is None:
    #  raise Sorry("Must specify output.model_file_name")
    if self.params.output.description_file_name is None:
      raise Sorry("Must specify output.description_file_name")

    # Turn on profiling if we've been asked to in the Phil parameters
    if self.params.profile:
      import cProfile
      self._pr = cProfile.Profile()
      self._pr.enable()

# ------------------------------------------------------------------------------

  def run(self):

    # String describing the run that will be output to the specified file.
    outString = 'reduce2 v.{}, run {}\n'.format(version, datetime.now().strftime("%Y-%m-%d %H:%M:%S"))
    for a in sys.argv:
      outString += ' {}'.format(a)
    outString += '\n'

    make_sub_header('Loading Model', out=self.logger)

    # Get our model.
    self.model = self.data_manager.get_model()

    # Fix up bogus unit cell when it occurs by checking crystal symmetry.
    cs = self.model.crystal_symmetry()
    if (cs is None) or (cs.unit_cell() is None):
      self.model = shift_and_box_model(model = self.model)

    if self.params.approach == 'add':
      # Add Hydrogens to the model
      make_sub_header('Adding Hydrogens', out=self.logger)
      startAdd = time.clock()
      reduce_add_h_obj = reduce_hydrogen.place_hydrogens(
        model = self.model,
        n_terminal_charge=self.params.n_terminal_charge
      )
      reduce_add_h_obj.run()
      self.model = reduce_add_h_obj.get_model()
      doneAdd = time.clock()

      # Interpret the model after shifting and adding Hydrogens to it so that
      # all of the needed fields are filled in when we use them below.
      # @todo Remove this once place_hydrogens() does all the interpretation we need.
      make_sub_header('Interpreting Hydrogenated Model', out=self.logger)
      startInt = time.clock()
      p = mmtbx.model.manager.get_default_pdb_interpretation_params()
      p.pdb_interpretation.allow_polymer_cross_special_position=True
      p.pdb_interpretation.clash_guard.nonbonded_distance_threshold=None
      p.pdb_interpretation.proceed_with_excessive_length_bonds=True
      #p.pdb_interpretation.sort_atoms=True
      self.model.process(make_restraints=True, pdb_interpretation_params=p) # make restraints
      doneInt = time.clock()

      make_sub_header('Optimizing', out=self.logger)
      startOpt = time.clock()
      Optimizers.probePhil = self.params.probe
      opt = Optimizers.FastOptimizer(self.params.add_flip_movers, self.model, probeRadius=0.25,
        altID=self.params.alt_id, preferenceMagnitude=self.params.preference_magnitude)
      doneOpt = time.clock()
      outString += opt.getInfo()
      outString += 'Time to Add Hydrogen = '+str(doneAdd-startAdd)+'\n'
      outString += 'Time to Interpret = '+str(doneInt-startInt)+'\n'
      outString += 'Time to Optimize = '+str(doneOpt-startOpt)+'\n'

    else: # Removing Hydrogens from the model rather than adding them.
      make_sub_header('Removing Hydrogens', out=self.logger)
      sel = self.model.selection("element H")
      for a in self.model.get_atoms():
        if sel[a.i_seq]:
          a.parent().remove_atom(a)

    # Re-process the model because we have removed some atoms that were previously
    # bonded.  Don't make restraints during the reprocessing.
    # We had to do this to keep from crashing on a call to pair_proxies when generating
    # mmCIF files, so we always do it for safety.
    self.model.process(make_restraints=False, pdb_interpretation_params=p)

    make_sub_header('Writing output', out=self.logger)

    # Write the description output to the specified file.
    of = open(self.params.output.description_file_name,"w")
    of.write(outString)
    of.close()

    # Determine whether to write a PDB or CIF file and write the appropriate text output.
    # Then determine the output file name and write it there.
    if str(self.params.output.suffix).lower() == "pdb":
      txt = self.model.model_as_pdb()
      suffix = ".pdb"
    else:
      txt = self.model.model_as_mmcif()
      suffix = ".cif"
    if self.params.output.model_file_base_name is not None:
      base = self.params.output.model_file_base_name
    else:
      file_name = self.data_manager.get_model_names()[0]
      base = os.path.splitext(os.path.basename(file_name))[0] + "_reduced"
    fullname = base+suffix
    with open(fullname, 'w') as f:
      f.write(txt)

    print('Wrote',fullname,'and',self.params.output.description_file_name, file = self.logger)

    # Report profiling info if we've been asked to in the Phil parameters
    if self.params.profile:
      print('Profile results:')
      import pstats
      profile_params = {'sort_by': 'time', 'num_entries': 20}
      self._pr.disable()
      ps = pstats.Stats(self._pr).sort_stats(profile_params['sort_by'])
      ps.print_stats(profile_params['num_entries'])

# ------------------------------------------------------------------------------

  def get_results(self):
    return group_args(model = self.model)

# ------------------------------------------------------------------------------

  def Test(self):
    '''
      Run tests on the methods of the class.  Throw an assertion error if there is a problem with
      one of them and return normally if there is not a problem.
    '''

    #=====================================================================================
    # @todo Unit tests for other methods
